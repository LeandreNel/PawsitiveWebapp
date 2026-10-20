import sql from "mssql";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const connection = new sql.ConnectionPool({
  server: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 1433),
  user: process.env.DB_USER ?? "sa",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "pawsitive",
  connectionTimeout: 60000,
  requestTimeout: 30000,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
});
let connecting;

function getConnection() {
  connecting ??= connection.connect().catch((error) => {
    connecting = undefined;
    throw error;
  });
  return connecting;
}

function inputType(value) {
  if (typeof value === "string") {
    return sql.NVarChar(value.length > 4000 ? sql.MAX : 4000);
  }
  if (typeof value === "boolean") return sql.Bit;
  if (typeof value === "number") {
    return Number.isInteger(value) ? sql.Int : sql.Float;
  }
  if (value instanceof Date) return sql.DateTime2;
  return sql.NVarChar(4000);
}

// Runs a statement with mysql2-style `?` placeholders and result shape:
// SELECT → [rows]; anything else → [{ insertId, affectedRows }].
async function run(statement, params = []) {
  const request = (await getConnection()).request();
  let index = 0;
  const text = statement.replace(/\?/g, () => {
    const name = `param${index}`;
    const value = params[index++];
    request.input(name, inputType(value), value ?? null);
    return `@${name}`;
  });
  if (index !== params.length) {
    throw new Error(
      `Expected ${index} SQL parameters but received ${params.length}.`,
    );
  }

  if (/^\s*(SELECT|WITH)\b/i.test(text)) {
    const result = await request.query(text);
    return [result.recordset];
  }
  const isInsert = /^\s*INSERT\b/i.test(text);
  const result = await request.query(
    isInsert
      ? `${text}; SELECT CAST(SCOPE_IDENTITY() AS INT) AS insertId;`
      : text,
  );
  return [
    {
      insertId: isInsert ? result.recordset?.[0]?.insertId ?? null : null,
      affectedRows: result.rowsAffected[0] ?? 0,
    },
  ];
}

const pool = { query: run, execute: run };

export function isDuplicateKeyError(error) {
  return error?.number === 2627 || error?.number === 2601;
}

const scrypt = promisify(scryptCallback);

function createTable(name, definition) {
  return pool.query(
    `IF OBJECT_ID(N'dbo.${name}', N'U') IS NULL CREATE TABLE dbo.${name} (${definition})`,
  );
}

export async function initializeDatabase() {
  await createTable(
    "tasks",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      title NVARCHAR(160) NOT NULL,
      description NVARCHAR(MAX) NOT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'done')),
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    `,
  );

  await createTable(
    "users",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      name NVARCHAR(120) NOT NULL,
      email NVARCHAR(254) NOT NULL UNIQUE,
      password_hash NVARCHAR(255) NOT NULL,
      role NVARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'staff')),
      profile_image NVARCHAR(MAX) NULL,
      profile_image_mime NVARCHAR(32) NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    `,
  );
  await createTable(
    "sessions",
    `
      token_hash NVARCHAR(64) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      expires_at DATETIME2(0) NOT NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX sessions_expiry_idx (expires_at)
    `,
  );
  await createTable(
    "animals",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      name NVARCHAR(120) NOT NULL,
      type NVARCHAR(10) NOT NULL CHECK (type IN ('Dog', 'Cat')),
      breed NVARCHAR(160) NOT NULL DEFAULT '',
      age NVARCHAR(80) NOT NULL DEFAULT '',
      description NVARCHAR(MAX) NOT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Adopted')),
      image_key NVARCHAR(10) NOT NULL CHECK (image_key IN ('dog', 'cat')),
      image_data NVARCHAR(MAX) NULL,
      image_mime NVARCHAR(32) NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
    `,
  );
  for (const [table, column, definition] of [
    ["users", "profile_image", "NVARCHAR(MAX) NULL"],
    ["users", "profile_image_mime", "NVARCHAR(32) NULL"],
    ["animals", "image_data", "NVARCHAR(MAX) NULL"],
    ["animals", "image_mime", "NVARCHAR(32) NULL"],
  ]) {
    await pool.query(
      `IF COL_LENGTH(N'dbo.${table}', N'${column}') IS NULL
       ALTER TABLE dbo.${table} ADD ${column} ${definition}`,
    );
  }
  await createTable(
    "shelter_events",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      title NVARCHAR(160) NOT NULL,
      event_date DATE NOT NULL,
      event_time TIME(0) NULL,
      kind NVARCHAR(10) NOT NULL DEFAULT 'event'
        CHECK (kind IN ('medical', 'supply', 'event')),
      notes NVARCHAR(MAX) NOT NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      INDEX events_date_idx (event_date)
    `,
  );
  await createTable(
    "availability",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      available_date DATE NOT NULL UNIQUE,
      available_time TIME(0) NOT NULL,
      updated_by INT NOT NULL,
      updated_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT availability_user_fk FOREIGN KEY (updated_by) REFERENCES users(id)
    `,
  );
  await createTable(
    "site_visits",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      visit_date DATE NOT NULL UNIQUE,
      visit_time TIME(0) NOT NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT site_visits_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX site_visits_user_idx (user_id, visit_date)
    `,
  );
  await createTable(
    "team_notices",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      message NVARCHAR(1000) NOT NULL,
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT notices_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `,
  );
  await createTable(
    "donations",
    `
      id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      payment_id NVARCHAR(100) NOT NULL UNIQUE,
      amount DECIMAL(10, 2) NOT NULL,
      donor_name NVARCHAR(160) NOT NULL DEFAULT 'Anonymous',
      donor_email NVARCHAR(254) NOT NULL,
      category NVARCHAR(10) NOT NULL DEFAULT 'General'
        CHECK (category IN ('General', 'Food', 'Medical')),
      payment_method NVARCHAR(40) NOT NULL DEFAULT 'PayFast',
      status NVARCHAR(10) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Completed', 'Failed')),
      created_at DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
      completed_at DATETIME2(0) NULL,
      INDEX donations_created_idx (created_at),
      INDEX donations_status_idx (status)
    `,
  );

  const [[{ count }]] = await pool.query(
    "SELECT COUNT(*) AS count FROM animals",
  );
  if (Number(count) === 0) {
    await pool.query(
      `INSERT INTO animals (name, type, breed, age, description, image_key) VALUES
        ('Baxter', 'Dog', 'Beagle mix', '2 years', 'A curious, gentle companion who loves exploring and meeting new people.', 'dog'),
        ('Bruno', 'Dog', 'Labrador mix', '3 years', 'A loyal, playful dog who enjoys spending time with people.', 'dog'),
        ('Snuggy', 'Dog', 'Terrier mix', '1 year', 'A lively young dog with lots of affection to share.', 'dog'),
        ('Milo', 'Cat', 'Domestic shorthair', '4 years', 'A calm, affectionate cat looking for a comfortable home.', 'cat')`,
    );
  }

  const email = process.env.INITIAL_STAFF_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_STAFF_PASSWORD;
  if (email && password) {
    if (password.length < 12) {
      throw new Error(
        "INITIAL_STAFF_PASSWORD must contain at least 12 characters.",
      );
    }
    const salt = randomBytes(16).toString("hex");
    const derived = await scrypt(password, salt, 64);
    const passwordHash = `${salt}:${derived.toString("hex")}`;
    await pool.execute(
      `MERGE users WITH (HOLDLOCK) AS target
       USING (SELECT ? AS name, ? AS email, ? AS password_hash) AS source
       ON target.email = source.email
       WHEN MATCHED THEN UPDATE SET
         name = source.name,
         password_hash = source.password_hash,
         role = 'staff'
       WHEN NOT MATCHED THEN
         INSERT (name, email, password_hash, role)
         VALUES (source.name, source.email, source.password_hash, 'staff');`,
      [
        process.env.INITIAL_STAFF_NAME?.trim() || "Shelter staff",
        email,
        passwordHash,
      ],
    );
  }

  await pool.query("DELETE FROM sessions WHERE expires_at <= SYSUTCDATETIME()");
}

export default pool;
