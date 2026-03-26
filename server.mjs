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

//-----------------------------------------------------------//
function getLang(req) {
  const h = (req.headers["accept-language"] || "").toLowerCase();
  return h.startsWith("no") || h.startsWith("nb") || h.startsWith("nn") ? "no" : "en";
}

const messages = {
  en: {
    required_user_pass: "username and password are required",
    must_accept_tos: "You must accept ToS",
    username_exists: "username already exists",
    user_not_found: "user not found",
    invalid_credentials: "invalid credentials",
    required_user_pass_tos: "username, password and tosVersion are required",
  },
  no: {
    required_user_pass: "brukernavn og passord er påkrevd",
    must_accept_tos: "du må godta vilkårene",
    username_exists: "brukernavn finnes allerede",
    user_not_found: "bruker ikke funnet",
    invalid_credentials: "ugyldig brukernavn/passord",
    required_user_pass_tos: "brukernavn, passord og tosVersion er påkrevd",
  },
};

function err(res, req, status, key) {
  const lang = getLang(req);
  return res.status(status).json({ ok: false, error: messages[lang][key] || key });
}

// -------------------- Password helpers --------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

// -------------------- Storage: Postgres when DATABASE_URL exists, else memory --------------------
let pool = null;
const usersMemory = new Map(); // username -> user

async function initDbIfConfigured() {
  if (!process.env.DATABASE_URL) {
    console.log("ℹ️ DATABASE_URL not set — using in-memory storage");
    return;
  }

  try {
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
  } catch (e) {
    pool = null;
    console.log("⚠️ Database connection failed — falling back to in-memory storage");
    console.log(e?.message ?? e);
  }
}

function safeIso(value) {
  // pg can return Date objects depending on config; normalize to ISO string for JSON
  if (!value) return value;
  return value instanceof Date ? value.toISOString() : value;
}

// -------------------- Legal docs --------------------
app.get("/api/legal/tos", (req, res) => {
  res.type("text/markdown").sendFile(path.join(__dirname, "docs", "tos.md"));
});

app.get("/api/legal/privacy", (req, res) => {
  res.type("text/markdown").sendFile(path.join(__dirname, "docs", "privacy.md"));
});

// -------------------- Users: CREATE --------------------
app.post("/api/users", async (req, res) => {
  try {
    const { username, password, accptTOS, tosVersion = "v1" } = req.body ?? {};

    if (!username || !password) return err(res, req, 400, "required_user_pass");
    if (accptTOS !== true) return err(res, req, 400, "must_accept_tos");

    const now = new Date().toISOString();

    if (pool) {
      const existing = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
      if (existing.rowCount > 0) return err(res, req, 409, "username_exists");

      const { salt, hash } = hashPassword(password);
      const id = crypto.randomUUID();

      await pool.query(
        `INSERT INTO users (id, username, password_hash, password_salt, tos_version, consented_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, username, hash, salt, tosVersion, now, now]
      );

      return res.status(201).json({
        ok: true,
        user: { id, username, tosVersion, consentedAt: now, createdAt: now },
      });
    }

    if (usersMemory.has(username)) return err(res, req, 409, "username_exists");

    const { salt, hash } = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      tosVersion,
      consentedAt: now,
      createdAt: now,
    };

    usersMemory.set(username, user);

    return res.status(201).json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        tosVersion: user.tosVersion,
        consentedAt: user.consentedAt,
        createdAt: user.createdAt,
      },
    });
  } catch (e) {
    console.log(e?.message ?? e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// -------------------- Users: DELETE --------------------
app.delete("/api/users", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};
    if (!username || !password) return err(res, req, 400, "required_user_pass");

    if (pool) {
      const found = await pool.query(
        "SELECT password_hash, password_salt FROM users WHERE username = $1",
        [username]
      );
      if (found.rowCount === 0) return err(res, req, 404, "user_not_found");

      const dbUser = found.rows[0];
      if (!verifyPassword(password, dbUser.password_salt, dbUser.password_hash)) {
        return err(res, req, 401, "invalid_credentials");
      }

      await pool.query("DELETE FROM users WHERE username = $1", [username]);
      return res.status(204).send();
    }

    const memoryUser = usersMemory.get(username);
    if (!memoryUser) return err(res, req, 404, "user_not_found");
    if (!verifyPassword(password, memoryUser.passwordSalt, memoryUser.passwordHash)) {
      return err(res, req, 401, "invalid_credentials");
    }

    usersMemory.delete(username);
    return res.status(204).send();
  } catch (e) {
    console.log(e?.message ?? e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// -------------------- Users: PATCH (update tosVersion) --------------------
app.patch("/api/users", async (req, res) => {
  try {
    const { username, password, tosVersion } = req.body ?? {};
    if (!username || !password || !tosVersion) return err(res, req, 400, "required_user_pass_tos");

    if (pool) {
      const found = await pool.query(
        "SELECT id, password_hash, password_salt, created_at FROM users WHERE username = $1",
        [username]
      );
      if (found.rowCount === 0) return err(res, req, 404, "user_not_found");

      const dbUser = found.rows[0];
      if (!verifyPassword(password, dbUser.password_salt, dbUser.password_hash)) {
        return err(res, req, 401, "invalid_credentials");
      }

      const updated = await pool.query(
        `UPDATE users
         SET tos_version = $2, consented_at = NOW()
         WHERE username = $1
         RETURNING id, username, tos_version, consented_at, created_at`,
        [username, tosVersion]
      );

      const updatedUser = updated.rows[0];

      return res.json({
        ok: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          tosVersion: updatedUser.tos_version,
          consentedAt: safeIso(updatedUser.consented_at),
          createdAt: safeIso(updatedUser.created_at),
        },
      });
    }

    const memoryUser = usersMemory.get(username);
    if (!memoryUser) return err(res, req, 404, "user_not_found");
    if (!verifyPassword(password, memoryUser.passwordSalt, memoryUser.passwordHash)) {
      return err(res, req, 401, "invalid_credentials");
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
  } catch (e) {
    console.log(e?.message ?? e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
});

// -------------------- Game --------------------
app.post("/api/games", validateChoice, (req, res) => {
  res.status(201).json({
    ok: true,
    playerChoice: req.body.playerChoice,
  });
});

// -------------------- Start --------------------
await initDbIfConfigured();

app.listen(port, () => {
  console.log(`stein saks papir ${port}`);
});