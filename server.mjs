import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath } from "node:url";
import pg from "pg";

import { validateChoice } from "../ap2_steinsakspapir_middleware/src/validateChoice.mjs";
import { rejects } from "node:assert";

const { Pool } = pg;

const__dirname = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8080;

const app = express();
app.use(express.json());
app.use(express.static('public'))


//---------------------------------------------------------------------------//

//const users = new Map(); //brukernavn

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

//--------------------------------------------------------------------------//

let pool = null;

const usersMemory = new Map();

if (process.env.DATABASE_URL) {
  pool = new pool({
    conneectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

//--------------------------------------------------------------------------//

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


//---------------------------------------------------------------------------//

//--brukervilkår--//

app.get("/api/legal/tos", (req, res) => {
  res.type("text/markdown").sendFile(path.join(__dirname, "docs", "tos.md"));

});

app.get("/api/legal/privacy" , (req, res) => {
  res.type("text/markdown").sendFile(path.join (__dirname, "docs", "privacy.md")); 

});

//---------------------------------------------------------------------------//


//--lag bruker--//

app.post("/api/users", (req, res) => {
  const {username, password, accptTOS, tosVersion = "v1"} = req.body ?? {};


if (!username || !password) {
  return res.status(400).json ({ ok: false, error: "username and password are required"});
}

if (accptTOS !== true) {
  return res.status(400).json({ ok: false, error: "You must accsept TOS"});
}


//----DB path----------------------------------------------------------------//

if (pool) {
  const exsisting = await pool.querry("SELECT 1 FROM Users WHERE USErname=$1" , [
    username
  ]);
  if exsisting.rowCount > 0) {
    return res
    .status(409)
    .json({ ok: false, errir: "user alredy exsists" });
  }
   
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash: hash,
    passwordSalt: salt,
    tosVersion,
    consentedAt: new Date().toISOString(),
    createdAt: new Date().toString(),
  };

  await pool.query(
     `INSERT INTO users (id, username, password_hash, password_salt, tos_version, consented_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
       [
        user.id,
        user.username,
        user.passwordHash,
        user.passwordSalt,
        user. tosVersion,
        user.consentedAt,
        user. createdAt,
       ]
  );

  return res.status(201).json({
    ok:true,
    user: {
      id: user.id,
      username: user.username,
      tosVersion: user.tosVersion,
      consentedAt: user.consentedAt,
    },
  });
}

//---memory path-----------------------------------------------------//

if (users.has(username)) {
  return res.status(409).json({ ok: false, error: "username alredy exsists" });
}



//-------------------------------------------------------------------------------//

const { salt, hash } = hashPassword(password);
const user = {
  id: crypto.randomUUID(),
  username,
  passwordHash: hash,
  passwordSalt: salt,

tosVersion,
consentedAt: new Date().toISOString(),
createdAt: new Date().toISOString(),
};

//--------------------------------------------------------------------------//

users.set(username, user);

 res.status(201).json({
  ok: true,
  user: {
    id: user.id,
    username: user.username,
    tosVersion: user.tosVersion,
    consentedAt: user.consentedAt,
    createdAt: user.consentedAt,
  }
});
});

//-------------------------------------------------------------------------//

  //--slett bruker--// 
  
  app.delete("/api/users", (req, res) => {
  console.log
    const {username, password } = req.body ?? {};
  const user = users.get(username);

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "username amd passowrd are rquierd" });
  }
  if (!user) {
    return res.status(404).json({ ok: false, error: "user not found" });
  }
  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "invalid credentials" }); 
  }
  
  //----------------------------------------------------------------------//
  //--slett persondata--//
 
 users.delete(username);

 return res.status(204).send();

});



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post("/api/games", validateChoice, (req, res) => {
  res.status(201).json({
    ok: true,
    playerChoice: req.body.playerChoice
  });
});

app.listen(port, () => {
  console.log(`stein saks papir ${port}`)
});


//------------------------------------------------------------------------//

      //--------------------public mappefil funksjon-----------------//

app.patch("/api/users", (req, res) => {
  const { username, password, tosVersion } = req.body ?? {};
  if (!username || !password || !tosVersion) {
    return res.status(400).json({ ok: false, error: "username, password and tosVersion are required" });
  }

  const user = users.get(username);
  if (!user) return res.status(404).json({ ok: false, error: "user not found" });

  if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "invalid credentials" });
  }

  user.tosVersion = tosVersion;
  user.consentedAt = new Date().toISOString();
  users.set(username, user);

  return res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      tosVersion: user.tosVersion,
      consentedAt: user.consentedAt,
      createdAt: user.createdAt,
    },
  });
});



//----------------------------------------------------------------------------//

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});