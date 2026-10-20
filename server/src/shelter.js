import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import express from "express";
import pool, { isDuplicateKeyError } from "./db.js";

const router = express.Router();
const scrypt = promisify(scryptCallback);
const sessionDuration = 1000 * 60 * 60 * 24 * 14;
const validAnimalStatuses = new Set(["Available", "Adopted"]);
const validEventKinds = new Set(["event", "medical", "supply"]);
const validDonationCategories = new Set(["General", "Food", "Medical"]);
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 512 * 1024;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

// server/src/shelter.js
function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = process.env.NODE_ENV === "production" ? "None" : "Lax"; // Must be "None" in production for cross-domain
  response.setHeader(
    "Set-Cookie",
    `pawsitive_session=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${sessionDuration / 1000}${secure}`,
  );
}

// function readCookie(request, name) {
//   const cookie = request.headers.cookie
//     ?.split(";")
//     .map((part) => part.trim())
//     .find((part) => part.startsWith(`${name}=`));
//   return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
// }

// async function userFromSession(request) {
//   const token = readCookie(request, "pawsitive_session");
//   if (!token) return null;
//   const [rows] = await pool.execute(
//     `SELECT users.id, users.name, users.email, users.role,
//        users.profile_image_mime IS NOT NULL AS hasProfileImage
//      FROM sessions JOIN users ON users.id = sessions.user_id
//      WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()`,
//     [hashToken(token)],
//   );
//   if (!rows[0]) return null;
//   return {
//     id: rows[0].id,
//     name: rows[0].name,
//     email: rows[0].email,
//     role: rows[0].role,
//     profileImageUrl: rows[0].hasProfileImage
//       ? "/api/auth/profile-image"
//       : null,
//   };
// }
async function userFromSession(request) {
  const token = readCookie(request, "pawsitive_session");
  if (!token) return null;
  const [rows] = await pool.execute(
    `SELECT users.id, users.name, users.email, users.role,
       CASE WHEN users.profile_image_mime IS NOT NULL THEN 1 ELSE 0 END AS hasProfileImage
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > SYSUTCDATETIME()`,
    [hashToken(token)],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    email: rows[0].email,
    role: rows[0].role,
    profileImageUrl: rows[0].hasProfileImage ? "/api/auth/profile-image" : null,
  };
}

async function optionalUser(request, _response, next) {
  try {
    request.user = await userFromSession(request);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireStaff(request, response, next) {
  try {
    request.user = await userFromSession(request);
    if (!request.user) {
      return response.status(401).json({ error: "Sign in to continue." });
    }
    if (request.user.role !== "staff") {
      return response.status(403).json({ error: "Staff access is required." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuthenticated(request, response, next) {
  try {
    request.user = await userFromSession(request);
    if (!request.user) {
      return response.status(401).json({ error: "Sign in to continue." });
    }
    next();
  } catch (error) {
    next(error);
  }
}

async function verifyPassword(userId, password) {
  if (typeof password !== "string") return false;
  const [rows] = await pool.execute(
    "SELECT password_hash FROM users WHERE id = ?",
    [userId],
  );
  if (!rows[0]) return false;
  const [salt, storedHex] = rows[0].password_hash.split(":");
  const derived = await scrypt(password, salt, 64);
  const stored = Buffer.from(storedHex, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = process.env.NODE_ENV === "production" ? "None" : "Lax";
  response.setHeader(
    "Set-Cookie",
    `pawsitive_session=${encodeURIComponent(token)}; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=${sessionDuration / 1000}${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const sameSite = process.env.NODE_ENV === "production" ? "None" : "Lax";
  response.setHeader(
    "Set-Cookie",
    `pawsitive_session=; HttpOnly; SameSite=${sameSite}; Path=/; Max-Age=0${secure}`,
  );
}

async function createSession(userId, response) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDuration);
  await pool.execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [hashToken(token), userId, expiresAt],
  );
  setSessionCookie(response, token);
}

function validEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function parseImageData(value) {
  if (value === null) return { value: null };
  if (typeof value !== "string") {
    return { error: "Choose a valid JPEG, PNG, or WebP image." };
  }
  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match || !imageMimeTypes.has(match[1])) {
    return { error: "Choose a valid JPEG, PNG, or WebP image." };
  }
  const encodedImage = match[2];
  const padding = encodedImage.endsWith("==")
    ? 2
    : encodedImage.endsWith("=")
      ? 1
      : 0;
  const decodedSize = Math.floor((encodedImage.length * 3) / 4) - padding;
  if (!decodedSize || decodedSize > maxImageBytes) {
    return {
      error: "Images must be optimized to 512 KB or smaller before upload.",
    };
  }
  const buffer = Buffer.from(encodedImage, "base64");
  if (buffer.toString("base64") !== encodedImage) {
    return { error: "Choose a valid JPEG, PNG, or WebP image." };
  }
  const validSignature =
    (match[1] === "image/jpeg" &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (match[1] === "image/png" &&
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (match[1] === "image/webp" &&
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP");
  if (!validSignature)
    return { error: "The selected file does not match its image type." };
  return { value: { data: match[2], mime: match[1] } };
}

function validateAnimal(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type;
  const breed = typeof body.breed === "string" ? body.breed.trim() : "";
  const age = typeof body.age === "string" ? body.age.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const status = body.status ?? "Available";
  const image =
    body.imageData === undefined ? undefined : parseImageData(body.imageData);
  if (!name || name.length > 120) {
    return {
      error: "Animal name is required and must be 120 characters or fewer.",
    };
  }
  if (!["Dog", "Cat"].includes(type)) {
    return { error: "Animal type must be Dog or Cat." };
  }
  if (breed.length > 160 || age.length > 80 || description.length > 5000) {
    return { error: "Breed, age, or description exceeds the allowed length." };
  }
  if (!validAnimalStatuses.has(status)) {
    return { error: "Animal status must be Available or Adopted." };
  }
  if (image?.error) return { error: image.error };
  return {
    value: {
      name,
      type,
      breed,
      age,
      description,
      status,
      imageKey: type === "Cat" ? "cat" : "dog",
      imageData:
        image?.value?.data ?? (body.imageData === null ? null : undefined),
      imageMime: image?.value?.mime ?? null,
      imageChanged: body.imageData !== undefined,
    },
  };
}

function validateDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

router.post("/auth/signup", async (request, response, next) => {
  const name =
    typeof request.body.name === "string" ? request.body.name.trim() : "";
  const email =
    typeof request.body.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
  const password = request.body.password;
  if (!name || name.length > 120 || !validEmail(email)) {
    return response
      .status(400)
      .json({ error: "Enter a valid name and email address." });
  }
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 200
  ) {
    return response
      .status(400)
      .json({ error: "Password must be between 10 and 200 characters." });
  }

  try {
    const salt = randomBytes(16).toString("hex");
    const derived = await scrypt(password, salt, 64);
    const passwordHash = `${salt}:${derived.toString("hex")}`;
    const [insert] = await pool.execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
      [name, email, passwordHash],
    );
    const [users] = await pool.execute(
      `SELECT id, name, email, role,
       CASE WHEN profile_image_mime IS NOT NULL THEN 1 ELSE 0 END AS hasProfileImage
       FROM users WHERE id = ?`,
      [insert.insertId],
    );
    await createSession(insert.insertId, response);
    response.status(201).json({
      user: {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
        role: users[0].role,
        profileImageUrl: users[0].hasProfileImage
          ? "/api/auth/profile-image"
          : null,
      },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return response
        .status(409)
        .json({ error: "An account with that email already exists." });
    }
    next(error);
  }
});

router.post("/auth/login", async (request, response, next) => {
  const email =
    typeof request.body.email === "string"
      ? request.body.email.trim().toLowerCase()
      : "";
  const password = request.body.password;
  if (!validEmail(email) || typeof password !== "string") {
    return response
      .status(400)
      .json({ error: "Enter your email and password." });
  }
  try {
    const [users] = await pool.execute(
      "SELECT id, name, email, role, password_hash, profile_image_mime FROM users WHERE email = ?",
      [email],
    );
    const user = users[0];
    if (!user)
      return response
        .status(401)
        .json({ error: "Email or password is incorrect." });
    const [salt, storedHex] = user.password_hash.split(":");
    const derived = await scrypt(password, salt, 64);
    const stored = Buffer.from(storedHex, "hex");
    if (stored.length !== derived.length || !timingSafeEqual(stored, derived)) {
      return response
        .status(401)
        .json({ error: "Email or password is incorrect." });
    }
    await createSession(user.id, response);
    response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profile_image_mime
          ? "/api/auth/profile-image"
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", optionalUser, (request, response) => {
  response.json({ user: request.user });
});

router.get(
  "/auth/profile-image",
  requireAuthenticated,
  async (request, response, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT profile_image, profile_image_mime FROM users WHERE id = ?",
        [request.user.id],
      );
      if (!rows[0]?.profile_image) {
        return response
          .status(404)
          .json({ error: "Profile picture not found." });
      }
      response.set("Cache-Control", "private, no-store");
      response.set("X-Content-Type-Options", "nosniff");
      response.type(rows[0].profile_image_mime);
      response.send(Buffer.from(rows[0].profile_image, "base64"));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/auth/profile",
  requireAuthenticated,
  async (request, response, next) => {
    const name =
      typeof request.body.name === "string" ? request.body.name.trim() : "";
    const email =
      typeof request.body.email === "string"
        ? request.body.email.trim().toLowerCase()
        : "";
    const currentPassword = request.body.currentPassword;
    const newPassword = request.body.newPassword;
    const profileImage =
      request.body.profileImageData === undefined
        ? undefined
        : parseImageData(request.body.profileImageData);
    if (!name || name.length > 120 || !validEmail(email)) {
      return response
        .status(400)
        .json({ error: "Enter a valid name and email address." });
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      return response.status(400).json({
        error: "Enter your current password to save profile changes.",
      });
    }
    if (
      newPassword &&
      (typeof newPassword !== "string" ||
        newPassword.length < 10 ||
        newPassword.length > 200)
    ) {
      return response
        .status(400)
        .json({ error: "New password must be between 10 and 200 characters." });
    }
    if (profileImage?.error) {
      return response.status(400).json({ error: profileImage.error });
    }

    try {
      if (!(await verifyPassword(request.user.id, currentPassword))) {
        return response
          .status(401)
          .json({ error: "Your current password is incorrect." });
      }
      const passwordHash = newPassword
        ? await (async () => {
            const salt = randomBytes(16).toString("hex");
            const derived = await scrypt(newPassword, salt, 64);
            return `${salt}:${derived.toString("hex")}`;
          })()
        : null;
      await pool.execute(
        `UPDATE users SET name = ?, email = ?, password_hash = COALESCE(?, password_hash),
       profile_image = IF(?, ?, profile_image),
       profile_image_mime = IF(?, ?, profile_image_mime)
       WHERE id = ?`,
        [
          name,
          email,
          passwordHash,
          profileImage !== undefined,
          profileImage?.value?.data ?? null,
          profileImage !== undefined,
          profileImage?.value?.mime ?? null,
          request.user.id,
        ],
      );
      response.json({
        user: {
          ...request.user,
          name,
          email,
          profileImageUrl:
            profileImage === undefined
              ? request.user.profileImageUrl
              : profileImage.value
                ? "/api/auth/profile-image"
                : null,
        },
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return response
          .status(409)
          .json({ error: "An account with that email already exists." });
      }
      next(error);
    }
  },
);

router.delete(
  "/auth/me",
  requireAuthenticated,
  async (request, response, next) => {
    if (request.user.role === "staff") {
      return response
        .status(403)
        .json({ error: "Staff accounts cannot be deleted here." });
    }
    const password = request.body?.password;
    if (!(await verifyPassword(request.user.id, password))) {
      return response
        .status(401)
        .json({ error: "Your password is incorrect." });
    }
    try {
      await pool.execute("DELETE FROM users WHERE id = ?", [request.user.id]);
      clearSessionCookie(response);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.post("/auth/logout", async (request, response, next) => {
  try {
    const token = readCookie(request, "pawsitive_session");
    if (token) {
      await pool.execute("DELETE FROM sessions WHERE token_hash = ?", [
        hashToken(token),
      ]);
    }
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/animals", optionalUser, async (request, response, next) => {
  try {
    const [animals] = await pool.query(
      `SELECT id, name, type, breed, age, description, status, image_key AS imageKey,
       CASE WHEN image_data IS NULL THEN NULL ELSE CONCAT('/api/animals/', id, '/image') END AS imageUrl
       FROM animals ${request.user?.role === "staff" ? "" : "WHERE status = 'Available' "}
       ORDER BY created_at DESC, id DESC`,
    );
    response.json(animals);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/animals/:id/image",
  optionalUser,
  async (request, response, next) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return response.status(400).json({ error: "Invalid animal ID." });
    }
    try {
      const [rows] = await pool.execute(
        `SELECT image_data, image_mime FROM animals
       WHERE id = ? AND (status = 'Available' OR ? = 1)`,
        [id, request.user?.role === "staff"],
      );
      if (!rows[0]?.image_data) {
        return response.status(404).json({ error: "Animal image not found." });
      }

      response.set("Cache-Control", "public, max-age=3600");
      response.set("X-Content-Type-Options", "nosniff");
      response.type(rows[0].image_mime);
      response.send(Buffer.from(rows[0].image_data, "base64"));
    } catch (error) {
      next(error);
    }
  },
);

router.post("/animals", requireStaff, async (request, response, next) => {
  const result = validateAnimal(request.body ?? {});
  if (result.error) return response.status(400).json({ error: result.error });
  try {
    const animal = result.value;
    const [insert] = await pool.execute(
      `INSERT INTO animals (name, type, breed, age, description, status, image_key, image_data, image_mime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        animal.name,
        animal.type,
        animal.breed,
        animal.age,
        animal.description,
        animal.status,
        animal.imageKey,
        animal.imageData ?? null,
        animal.imageMime,
      ],
    );
    const [rows] = await pool.execute(
      `SELECT id, name, type, breed, age, description, status, image_key AS imageKey,
       CASE WHEN image_data IS NULL THEN NULL ELSE CONCAT('/api/animals/', id, '/image') END AS imageUrl
       FROM animals WHERE id = ?`,
      [insert.insertId],
    );
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/animals/:id", requireStaff, async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1)
    return response.status(400).json({ error: "Invalid animal ID." });
  const result = validateAnimal(request.body ?? {});
  if (result.error) return response.status(400).json({ error: result.error });
  try {
    const animal = result.value;
    const [update] = await pool.execute(
      `UPDATE animals SET name = ?, type = ?, breed = ?, age = ?, description = ?, status = ?, image_key = ?,
       image_data = CASE WHEN ? = 1 THEN ? ELSE image_data END,
       image_mime = CASE WHEN ? = 1 THEN ? ELSE image_mime END,
       updated_at = SYSUTCDATETIME()
       WHERE id = ?`,
      [
        animal.name,
        animal.type,
        animal.breed,
        animal.age,
        animal.description,
        animal.status,
        animal.imageKey,
        animal.imageChanged,
        animal.imageData ?? null,
        animal.imageChanged,
        animal.imageMime,
        id,
      ],
    );
    if (!update.affectedRows)
      return response.status(404).json({ error: "Animal not found." });
    const [rows] = await pool.execute(
      `SELECT id, name, type, breed, age, description, status, image_key AS imageKey,
       CASE WHEN image_data IS NULL THEN NULL ELSE CONCAT('/api/animals/', id, '/image') END AS imageUrl
       FROM animals WHERE id = ?`,
      [id],
    );
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/animals/:id", requireStaff, async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1)
    return response.status(400).json({ error: "Invalid animal ID." });
  try {
    const [result] = await pool.execute("DELETE FROM animals WHERE id = ?", [
      id,
    ]);
    if (!result.affectedRows)
      return response.status(404).json({ error: "Animal not found." });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/events", requireStaff, async (_request, response, next) => {
  try {
    const [events] = await pool.query(
      `SELECT id, title, CONVERT(char(10), event_date, 23) AS date,
       CONVERT(char(5), event_time, 108) AS time, kind, notes
       FROM shelter_events ORDER BY event_date, event_time, id`,
    );
    response.json(events);
  } catch (error) {
    next(error);
  }
});

router.post("/events", requireStaff, async (request, response, next) => {
  const title =
    typeof request.body.title === "string" ? request.body.title.trim() : "";
  const date = request.body.date;
  const time = request.body.time || null;
  const kind = request.body.kind ?? "event";
  const notes =
    typeof request.body.notes === "string" ? request.body.notes.trim() : "";
  if (!title || title.length > 160 || !validateDate(date)) {
    return response
      .status(400)
      .json({ error: "Event name and a valid date are required." });
  }
  if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return response.status(400).json({ error: "Enter a valid event time." });
  }
  if (!validEventKinds.has(kind) || notes.length > 5000) {
    return response
      .status(400)
      .json({ error: "Event type or notes are invalid." });
  }
  try {
    const [insert] = await pool.execute(
      "INSERT INTO shelter_events (title, event_date, event_time, kind, notes) VALUES (?, ?, ?, ?, ?)",
      [title, date, time, kind, notes],
    );
    response.status(201).json({
      id: insert.insertId,
      title,
      date,
      time,
      kind,
      notes,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/events/:id", requireStaff, async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1)
    return response.status(400).json({ error: "Invalid event ID." });
  try {
    const [result] = await pool.execute(
      "DELETE FROM shelter_events WHERE id = ?",
      [id],
    );
    if (!result.affectedRows)
      return response.status(404).json({ error: "Event not found." });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/availability", requireStaff, async (_request, response, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT CONVERT(char(10), available_date, 23) AS date,
       CONVERT(char(5), available_time, 108) AS time
       FROM availability ORDER BY available_date`,
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/availability/:date",
  requireStaff,
  async (request, response, next) => {
    const { date } = request.params;
    const time = request.body.time;
    if (
      !validateDate(date) ||
      typeof time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      return response
        .status(400)
        .json({ error: "Choose a valid date and time." });
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = now.toISOString().slice(11, 16);
    if (date < today || (date === today && time <= currentTime)) {
      return response
        .status(400)
        .json({ error: "Choose a future date and time." });
    }
    try {
      await pool.execute(
        `MERGE availability WITH (HOLDLOCK) AS target
         USING (SELECT CAST(? AS DATE) AS available_date, CAST(? AS TIME(0)) AS available_time, ? AS updated_by) AS source
         ON target.available_date = source.available_date
         WHEN MATCHED THEN UPDATE SET
           available_time = source.available_time,
           updated_by = source.updated_by,
           updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN
           INSERT (available_date, available_time, updated_by)
           VALUES (source.available_date, source.available_time, source.updated_by);`,
        [date, time, request.user.id],
      );
      response.json({ date, time });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/site-visits/availability", async (_request, response, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT CONVERT(char(10), availability.available_date, 23) AS date,
       CONVERT(char(5), availability.available_time, 108) AS time
       FROM availability
       LEFT JOIN site_visits ON site_visits.visit_date = availability.available_date
       WHERE (availability.available_date > CAST(SYSUTCDATETIME() AS DATE) OR
         (availability.available_date = CAST(SYSUTCDATETIME() AS DATE) AND availability.available_time > CAST(SYSUTCDATETIME() AS TIME)))
         AND site_visits.id IS NULL
       ORDER BY availability.available_date`,
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/site-visits", requireStaff, async (_request, response, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT site_visits.id,
       CONVERT(char(10), site_visits.visit_date, 23) AS date,
       CONVERT(char(5), site_visits.visit_time, 108) AS time,
       users.name, users.email
       FROM site_visits JOIN users ON users.id = site_visits.user_id
       WHERE site_visits.visit_date >= CAST(SYSUTCDATETIME() AS DATE)
       ORDER BY site_visits.visit_date, site_visits.visit_time`,
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/site-visits/mine",
  requireAuthenticated,
  async (request, response, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, DATE_FORMAT(visit_date, '%Y-%m-%d') AS date,
       TIME_FORMAT(visit_time, '%H:%i') AS time
       FROM site_visits WHERE user_id = ? AND visit_date >= UTC_DATE()
       ORDER BY visit_date`,
        [request.user.id],
      );
      response.json(rows);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/site-visits",
  requireAuthenticated,
  async (request, response, next) => {
    const date = request.body.date;
    if (!validateDate(date)) {
      return response.status(400).json({ error: "Choose a valid visit date." });
    }
    if (request.user.role !== "user") {
      return response
        .status(403)
        .json({ error: "Only public accounts can book site visits." });
    }
    try {
      const [result] = await pool.execute(
        `INSERT INTO site_visits (user_id, visit_date, visit_time)
       SELECT ?, available_date, available_time FROM availability
       WHERE available_date = ? AND
         (available_date > UTC_DATE() OR
           (available_date = UTC_DATE() AND available_time > UTC_TIME()))`,
        [request.user.id, date],
      );
      if (!result.affectedRows) {
        return response
          .status(409)
          .json({ error: "That visit date is no longer available." });
      }
      const [rows] = await pool.execute(
        `SELECT id, DATE_FORMAT(visit_date, '%Y-%m-%d') AS date,
       TIME_FORMAT(visit_time, '%H:%i') AS time FROM site_visits WHERE id = ?`,
        [result.insertId],
      );
      response.status(201).json(rows[0]);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return response
          .status(409)
          .json({ error: "That visit date has already been booked." });
      }
      next(error);
    }
  },
);

router.delete(
  "/site-visits/:id",
  requireAuthenticated,
  async (request, response, next) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return response.status(400).json({ error: "Invalid visit booking." });
    }
    try {
      const [result] = await pool.execute(
        "DELETE FROM site_visits WHERE id = ? AND user_id = ? AND visit_date >= UTC_DATE()",
        [id, request.user.id],
      );
      if (!result.affectedRows) {
        return response.status(404).json({ error: "Visit booking not found." });
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.get("/notices", requireStaff, async (_request, response, next) => {
  try {
    const [notices] = await pool.query(
      `SELECT TOP 20 team_notices.id, team_notices.message, users.name AS author,
       CONVERT(char(19), team_notices.created_at, 120) AS createdAt
       FROM team_notices JOIN users ON users.id = team_notices.user_id
       ORDER BY team_notices.created_at DESC`,
    );
    response.json(notices);
  } catch (error) {
    next(error);
  }
});

router.post("/notices", requireStaff, async (request, response, next) => {
  const message =
    typeof request.body.message === "string" ? request.body.message.trim() : "";
  if (!message || message.length > 1000) {
    return response
      .status(400)
      .json({ error: "Notice must contain 1 to 1000 characters." });
  }
  try {
    const [insert] = await pool.execute(
      "INSERT INTO team_notices (user_id, message) VALUES (?, ?)",
      [request.user.id, message],
    );
    response.status(201).json({
      id: insert.insertId,
      message,
      author: request.user.name,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/donations", requireStaff, async (request, response, next) => {
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const pageSize = 7;
  try {
    const [[stats]] = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'Completed' AND created_at >= DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1) THEN amount ELSE 0 END), 0) AS monthTotal,
        SUM(CASE WHEN status = 'Completed' AND created_at >= DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1) THEN 1 ELSE 0 END) AS monthCount,
        COALESCE(AVG(CASE WHEN status = 'Completed' THEN amount END), 0) AS averageAmount
       FROM donations`,
    );
    const [monthlyRows] = await pool.query(
      `SELECT CONVERT(char(7), created_at, 120) AS month,
       SUM(amount) AS total
       FROM donations
       WHERE status = 'Completed'
         AND created_at >= DATEADD(month, -5, DATEFROMPARTS(YEAR(SYSUTCDATETIME()), MONTH(SYSUTCDATETIME()), 1))
       GROUP BY CONVERT(char(7), created_at, 120) ORDER BY month`,
    );
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM donations",
    );
    const [rows] = await pool.execute(
      `SELECT id, payment_id AS paymentId, amount, donor_name AS donorName,
       category, payment_method AS paymentMethod, status,
       FORMAT(created_at, 'dd MMM yyyy', 'en-US') AS date
       FROM donations ORDER BY donations.created_at DESC, id DESC
       OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
      [(page - 1) * pageSize, pageSize],
    );
    response.json({
      donations: rows,
      page,
      pageSize,
      total: Number(total),
      stats: {
        monthTotal: Number(stats.monthTotal),
        monthCount: Number(stats.monthCount),
        averageAmount: Number(stats.averageAmount),
        monthly: monthlyRows.map((row) => ({
          month: row.month,
          total: Number(row.total),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/donations/export",
  requireStaff,
  async (_request, response, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT payment_id, amount, donor_name, donor_email, category, payment_method, status, created_at
       FROM donations ORDER BY created_at DESC, id DESC`,
      );
      const escapeCsv = (value) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [
        [
          "Payment ID",
          "Amount (ZAR)",
          "Donor",
          "Email",
          "Category",
          "Payment method",
          "Status",
          "Date",
        ],
        ...rows.map((row) => [
          row.payment_id,
          row.amount,
          row.donor_name,
          row.donor_email,
          row.category,
          row.payment_method,
          row.status,
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        ]),
      ]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\r\n");
      response.type("text/csv").attachment("pawsitive-donations.csv").send(csv);
    } catch (error) {
      next(error);
    }
  },
);

function encodePayfast(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, "+")
    .replace(
      /[!'()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

function payfastSignature(fields, passphrase) {
  const data = Object.entries(fields)
    .filter(
      ([, value]) => value !== "" && value !== null && value !== undefined,
    )
    .map(([key, value]) => `${encodePayfast(key)}=${encodePayfast(value)}`)
    .join("&");
  const passphraseField = passphrase
    ? `&passphrase=${encodePayfast(passphrase)}`
    : "";
  return createHash("md5").update(`${data}${passphraseField}`).digest("hex");
}

router.post("/donations/checkout", async (request, response, next) => {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE ?? "";
  const siteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const apiUrl = (process.env.PUBLIC_API_URL || siteUrl)?.replace(/\/+$/, "");
  if (!merchantId || !merchantKey || !siteUrl) {
    return response.status(503).json({
      error:
        "Online donations are not configured yet. Please contact the shelter directly.",
    });
  }
  const amount = Number(request.body.amount);
  const email =
    typeof request.body.email === "string" ? request.body.email.trim() : "";
  const donorName =
    typeof request.body.name === "string" ? request.body.name.trim() : "";
  const category = request.body.category ?? "General";
  if (
    !Number.isFinite(amount) ||
    amount < 10 ||
    amount > 100000 ||
    Math.round(amount * 100) !== amount * 100
  ) {
    return response
      .status(400)
      .json({ error: "Donation must be between R10 and R100,000." });
  }
  if (
    !validEmail(email) ||
    donorName.length > 160 ||
    !validDonationCategories.has(category)
  ) {
    return response
      .status(400)
      .json({ error: "Enter a valid email and donation category." });
  }
  try {
    const paymentId = `PAW-${Date.now()}-${randomBytes(5).toString("hex")}`;
    await pool.execute(
      `INSERT INTO donations (payment_id, amount, donor_name, donor_email, category)
       VALUES (?, ?, ?, ?, ?)`,
      [paymentId, amount.toFixed(2), donorName || "Anonymous", email, category],
    );
    const fields = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${siteUrl}/donation/complete`,
      cancel_url: `${siteUrl}/donate?cancelled=1`,
      notify_url: `${apiUrl}/api/payments/payfast/notify`,
      name_first: donorName,
      email_address: email,
      m_payment_id: paymentId,
      amount: amount.toFixed(2),
      item_name: `Pawsitive ${category.toLowerCase()} donation`,
    };
    fields.signature = payfastSignature(fields, passphrase);
    const sandbox = process.env.PAYFAST_SANDBOX === "true";
    response.json({
      url: sandbox
        ? "https://sandbox.payfast.co.za/eng/process"
        : "https://www.payfast.co.za/eng/process",
      fields,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/payments/payfast/notify", async (request, response, next) => {
  const fields = request.body ?? {};
  const receivedSignature = fields.signature;
  if (!receivedSignature || !fields.m_payment_id || !fields.amount_gross) {
    return response.status(400).send("Invalid notification.");
  }
  const unsignedFields = { ...fields };
  delete unsignedFields.signature;
  const expectedSignature = payfastSignature(
    unsignedFields,
    process.env.PAYFAST_PASSPHRASE ?? "",
  );
  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(receivedSignature, "hex");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return response.status(400).send("Invalid signature.");
  }
  if (
    fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID ||
    !process.env.PAYFAST_MERCHANT_ID
  ) {
    return response.status(400).send("Invalid merchant.");
  }
  try {
    const validationBody = new URLSearchParams(
      Object.entries(fields).map(([key, value]) => [key, String(value)]),
    );
    const validationHost =
      process.env.PAYFAST_SANDBOX === "true"
        ? "https://sandbox.payfast.co.za/eng/query/validate"
        : "https://www.payfast.co.za/eng/query/validate";
    const validation = await fetch(validationHost, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: validationBody,
      signal: AbortSignal.timeout(10000),
    });
    if (!validation.ok || (await validation.text()).trim() !== "VALID") {
      return response
        .status(400)
        .send("Payment notification validation failed.");
    }
    const [[donation]] = await pool.execute(
      "SELECT amount, status FROM donations WHERE payment_id = ?",
      [fields.m_payment_id],
    );
    if (
      !donation ||
      Number(donation.amount).toFixed(2) !==
        Number(fields.amount_gross).toFixed(2)
    ) {
      return response
        .status(400)
        .send("Payment does not match a pending donation.");
    }
    if (
      fields.payment_status === "COMPLETE" &&
      donation.status !== "Completed"
    ) {
      await pool.execute(
        `UPDATE donations SET status = 'Completed', completed_at = SYSUTCDATETIME()
         WHERE payment_id = ? AND status = 'Pending'`,
        [fields.m_payment_id],
      );
    } else if (
      fields.payment_status === "CANCELLED" ||
      fields.payment_status === "FAILED"
    ) {
      await pool.execute(
        "UPDATE donations SET status = 'Failed' WHERE payment_id = ? AND status = 'Pending'",
        [fields.m_payment_id],
      );
    }
    response.status(200).send("OK");
  } catch (error) {
    next(error);
  }
});

export default router;
