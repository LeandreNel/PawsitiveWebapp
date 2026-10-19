import "dotenv/config";
import cors from "cors";
import express from "express";
import pool, { initializeDatabase } from "./db.js";
import shelterRouter from "./shelter.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const statuses = new Set(["open", "in_progress", "done"]);
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// this is the newly added code to allow multiple origins for CORS - xoxo Kiera
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://localhost:5174");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use("/api", (request, response, next) => {
  const origin = request.get("Origin");
  if (
    mutatingMethods.has(request.method) &&
    origin &&
    !allowedOrigins.has(origin)
  ) {
    return response
      .status(403)
      .json({ error: "Request origin is not allowed." });
  }
  next();
});
app.use("/api", shelterRouter);

function validateTask(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const status = body.status ?? "open";

  if (!title || title.length > 160) {
    return { error: "Title is required and must be 160 characters or fewer." };
  }
  if (description.length > 5000) {
    return { error: "Description must be 5000 characters or fewer." };
  }
  if (!statuses.has(status)) {
    return { error: "Status must be open, in_progress, or done." };
  }

  return { value: { title, description, status } };
}

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (_request, response, next) => {
  try {
    const [tasks] = await pool.query(
      "SELECT id, title, description, status, CONVERT(char(19), created_at, 120) AS created_at, CONVERT(char(19), updated_at, 120) AS updated_at FROM tasks ORDER BY tasks.created_at DESC, id DESC",
    );
    response.json(tasks);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (request, response, next) => {
  const result = validateTask(request.body ?? {});
  if (result.error) return response.status(400).json({ error: result.error });

  try {
    const [insert] = await pool.execute(
      "INSERT INTO tasks (title, description, status) VALUES (?, ?, ?)",
      [result.value.title, result.value.description, result.value.status],
    );
    const [rows] = await pool.execute(
      "SELECT id, title, description, status, CONVERT(char(19), created_at, 120) AS created_at, CONVERT(char(19), updated_at, 120) AS updated_at FROM tasks WHERE id = ?",
      [insert.insertId],
    );
    response.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/tasks/:id", async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return response
      .status(400)
      .json({ error: "Task ID must be a positive integer." });
  }
  const result = validateTask(request.body ?? {});
  if (result.error) return response.status(400).json({ error: result.error });

  try {
    const [update] = await pool.execute(
      "UPDATE tasks SET title = ?, description = ?, status = ?, updated_at = SYSUTCDATETIME() WHERE id = ?",
      [result.value.title, result.value.description, result.value.status, id],
    );
    if (update.affectedRows === 0)
      return response.status(404).json({ error: "Task not found." });

    const [rows] = await pool.execute(
      "SELECT id, title, description, status, CONVERT(char(19), created_at, 120) AS created_at, CONVERT(char(19), updated_at, 120) AS updated_at FROM tasks WHERE id = ?",
      [id],
    );
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return response
      .status(400)
      .json({ error: "Task ID must be a positive integer." });
  }

  try {
    const [result] = await pool.execute("DELETE FROM tasks WHERE id = ?", [id]);
    if (result.affectedRows === 0)
      return response.status(404).json({ error: "Task not found." });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "An unexpected server error occurred." });
});

initializeDatabase()
  .then(() => {
    app.listen(port, () =>
      console.log(`API listening on http://localhost:${port}`),
    );
  })
  .catch((error) => {
    console.error("Could not initialize the database:", error.message);
    process.exitCode = 1;
  });
