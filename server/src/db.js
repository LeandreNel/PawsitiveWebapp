import mysql from "mysql2/promise";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "pawsitive",
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

const scrypt = promisify(scryptCallback);

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      description TEXT NOT NULL,
      status ENUM('open', 'in_progress', 'done') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user', 'staff') NOT NULL DEFAULT 'user',
      profile_image MEDIUMTEXT NULL,
      profile_image_mime VARCHAR(32) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) NOT NULL PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX sessions_expiry_idx (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS animals (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      type ENUM('Dog', 'Cat') NOT NULL,
      breed VARCHAR(160) NOT NULL DEFAULT '',
      age VARCHAR(80) NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      status ENUM('Available', 'Adopted') NOT NULL DEFAULT 'Available',
      image_key ENUM('dog', 'cat') NOT NULL,
      image_data MEDIUMTEXT NULL,
      image_mime VARCHAR(32) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const [table, column, definition] of [
    ["users", "profile_image", "MEDIUMTEXT NULL"],
    ["users", "profile_image_mime", "VARCHAR(32) NULL"],
    ["animals", "image_data", "MEDIUMTEXT NULL"],
    ["animals", "image_mime", "VARCHAR(32) NULL"],
  ]) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
    if (!columns.some((existing) => existing.Field === column)) {
      await pool.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
      );
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shelter_events (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      event_date DATE NOT NULL,
      event_time TIME NULL,
      kind ENUM('medical', 'supply', 'event') NOT NULL DEFAULT 'event',
      notes TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX events_date_idx (event_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      available_date DATE NOT NULL UNIQUE,
      available_time TIME NOT NULL,
      updated_by INT UNSIGNED NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT availability_user_fk FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      visit_date DATE NOT NULL UNIQUE,
      visit_time TIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT site_visits_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX site_visits_user_idx (user_id, visit_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_notices (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      message VARCHAR(1000) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT notices_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      payment_id VARCHAR(100) NOT NULL UNIQUE,
      amount DECIMAL(10, 2) NOT NULL,
      donor_name VARCHAR(160) NOT NULL DEFAULT 'Anonymous',
      donor_email VARCHAR(254) NOT NULL,
      category ENUM('General', 'Food', 'Medical') NOT NULL DEFAULT 'General',
      payment_method VARCHAR(40) NOT NULL DEFAULT 'PayFast',
      status ENUM('Pending', 'Completed', 'Failed') NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME NULL,
      INDEX donations_created_idx (created_at),
      INDEX donations_status_idx (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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
      throw new Error("INITIAL_STAFF_PASSWORD must contain at least 12 characters.");
    }
    const salt = randomBytes(16).toString("hex");
    const derived = await scrypt(password, salt, 64);
    const passwordHash = `${salt}:${derived.toString("hex")}`;
    await pool.execute(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'staff')
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         role = 'staff'`,
      [process.env.INITIAL_STAFF_NAME?.trim() || "Shelter staff", email, passwordHash],
    );
  }

  await pool.query("DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()");
}

export default pool;
