import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { validateChoice } from "./validateChoice.mjs";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8080;

const app = express();
app.use(express.json());
app.use(express.static("public"));

// -------------------- Password helpers --------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}

// -------------------- Database (robust) --------------------
let pool = null;
const usersMemory = new Map(); // fallback when DATABASE_URL is not set

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      username text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      password_salt text NOT NULL,
      tos_version text NOT NULL,
      consented_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL
    );
  `);

  console.log("✅ Database connected");
} else {
  console.log("ℹ️ DATABASE_URL not set — using in-memory storage");
}

// -------------------- Legal docs --------------------
app.get("/api/legal/tos", (req, res) => {
  res.type("text/markdown").sendFile(path.join(__dirname, "docs", "tos.md"));
});

app.get("/api/legal/privacy", (req, res) => {
  res
    .type("text/markdown")
    .sendFile(path.join(__dirname, "docs", "privacy.md"));
});

// -------------------- Users --------------------
app.post("/api/users", async (req, res) => {
  const { username, password, accptTOS, tosVersion = "v1" } = req.body ?? {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "username and password are required" });
  }

  if (accptTOS !== true) {
    return res.status(400).json({ ok: false, error: "You must accept TOS" });
  }

  // DB path
  if (pool) {
    const existingUserResult = await pool.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username]
    );

    if (existingUserResult.rowCount > 0) {
      return res
        .status(409)
        .json({ ok: false, error: "username already exists" });
    }

    const { salt, hash } = hashPassword(password);
    const newUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      tosVersion,
      consentedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO users (id, username, password_hash, password_salt, tos_version, consented_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        newUser.id,
        newUser.username,
        newUser.passwordHash,
        newUser.passwordSalt,
        newUser.tosVersion,
        newUser.consentedAt,
        newUser.createdAt,
      ]
    );

    return res.status(201).json({
      ok: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        tosVersion: newUser.tosVersion,
        consentedAt: newUser.consentedAt,
        createdAt: newUser.createdAt,
      },
    });
  }

  // Memory path
  if (usersMemory.has(username)) {
    return res
      .status(409)
      .json({ ok: false, error: "username already exists" });
  }

  const { salt, hash } = hashPassword(password);
  const newUser = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hash,
    passwordSalt: salt,
    tosVersion,
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  usersMemory.set(username, newUser);

  return res.status(201).json({
    ok: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      tosVersion: newUser.tosVersion,
      consentedAt: newUser.consentedAt,
      createdAt: newUser.createdAt,
    },
  });
});

app.delete("/api/users", async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res
      .status(400)
      .json({ ok: false, error: "username and password are required" });
  }

  // DB path
  if (pool) {
    const userLookupResult = await pool.query(
      "SELECT password_hash, password_salt FROM users WHERE username = $1",
      [username]
    );

    if (userLookupResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "user not found" });
    }

    const dbUser = userLookupResult.rows[0];

    if (!verifyPassword(password, dbUser.password_salt, dbUser.password_hash)) {
      return res
        .status(401)
        .json({ ok: false, error: "invalid credentials" });
    }

    await pool.query("DELETE FROM users WHERE username = $1", [username]);
    return res.status(204).send();
  }

  // Memory path
  const memoryUser = usersMemory.get(username);

  if (!memoryUser) {
    return res.status(404).json({ ok: false, error: "user not found" });
  }

  if (!verifyPassword(password, memoryUser.passwordSalt, memoryUser.passwordHash)) {
    return res.status(401).json({ ok: false, error: "invalid credentials" });
  }

  usersMemory.delete(username);
  return res.status(204).send();
});

app.patch("/api/users", async (req, res) => {
  const { username, password, tosVersion } = req.body ?? {};

  if (!username || !password || !tosVersion) {
    return res.status(400).json({
      ok: false,
      error: "username, password and tosVersion are required",
    });
  }

  // DB path
  if (pool) {
    const userLookupResult = await pool.query(
      "SELECT password_hash, password_salt FROM users WHERE username = $1",
      [username]
    );

    if (userLookupResult.rowCount === 0) {
      return res.status(404).json({ ok: false, error: "user not found" });
    }

    const dbUser = userLookupResult.rows[0];

    if (!verifyPassword(password, dbUser.password_salt, dbUser.password_hash)) {
      return res
        .status(401)
        .json({ ok: false, error: "invalid credentials" });
    }

    const updateResult = await pool.query(
      `UPDATE users
       SET tos_version = $2, consented_at = NOW()
       WHERE username = $1
       RETURNING id, username, tos_version, consented_at, created_at`,
      [username, tosVersion]
    );

    const updatedUserRow = updateResult.rows[0];

    return res.json({
      ok: true,
      user: {
        id: updatedUserRow.id,
        username: updatedUserRow.username,
        tosVersion: updatedUserRow.tos_version,
        consentedAt: updatedUserRow.consented_at,
        createdAt: updatedUserRow.created_at,
      },
    });
  }

  // Memory path
  const memoryUser = usersMemory.get(username);

  if (!memoryUser) {
    return res.status(404).json({ ok: false, error: "user not found" });
  }

  if (!verifyPassword(password, memoryUser.passwordSalt, memoryUser.passwordHash)) {
    return res.status(401).json({ ok: false, error: "invalid credentials" });
  }

  memoryUser.tosVersion = tosVersion;
  memoryUser.consentedAt = new Date().toISOString();
  usersMemory.set(username, memoryUser);

  return res.json({
    ok: true,
    user: {
      id: memoryUser.id,
      username: memoryUser.username,
      tosVersion: memoryUser.tosVersion,
      consentedAt: memoryUser.consentedAt,
      createdAt: memoryUser.createdAt,
    },
  });
});

// -------------------- Game --------------------
app.post("/api/games", validateChoice, (req, res) => {
  res.status(201).json({
    ok: true,
    playerChoice: req.body.playerChoice,
  });
});

app.listen(port, () => {
  console.log(`stein saks papir ${port}`);
});
