import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath } from "nodeurl";



import { validateChoice } from "../ap2_steinsakspapir_middleware/src/validateChoice.mjs";
import { error } from "node:console";

const_dirname = path.dirname(fileURLToPath(import.meta.url))
const port = 8080;

const app = express();
app.use(express.json());
app.use(express.static('public'))

// in memory users//
const users = new Map(); //brukernavn

function hashPassword(Password, salt, exspectedHash){
  const hash = crypto.scryptSync(Password, salt, 64).toString("hex");
  return {salt, hash };
} 

function verifyPassword(Password, salt, exspectedHash) {
  const hash = crypto.scryptSync(Password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(exspectedHash, "hex"));
}

//--brukervilkår--//

app.get("/api/legal/tos", (req, res) => {
  res.type("text/markdown").sendFile(path.join(__dirname, "docs", "tos.md"));

});

app.get("/api/legal/privacy" , (req, res) => {
  res.type("text/markdown").sendFile(path.join (__dirname, "docs", "privacy.md")); 

});

//--lag bruker--//

app.post("/api/users", (req, res) => {
  const {username, password, accptTOS, tosVersion = "v1"} = req.body ?? {};
} )

if (!username || password) {
  return res.status(400).json ({ ok: false, error: "username and password are required"});
}

if (accptTOS !== true) {
  return res.status(400).json({ ok: false, error: "You must accsept TOS"});
}

if (users.has(username)) {
  return res.status(409).json({ ok: false, error: "username alredy exsists" });
}

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

users.set(username, user);

return res.status(201).json({
  ok: true,
  user: {
    id: user.id,
    username: user.username,
    tosVersion: user.tosVersion,
    consentedAt: user.consentedAt,
    createdAt: user.consentedAt,
  }
});

  //--slett bruker--//

  app.delete("/api/users", (req, res) => {
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
  console.log('stein saks papir ${port}')
});
