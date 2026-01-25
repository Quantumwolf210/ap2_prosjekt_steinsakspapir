import express from "express";
import {createRequire } from "module";
const require = createRequire(import.meta.url);
const validateChoice = require ("ap2-steinsakspapir-middleware");

const port = 8080;
const app = express();
app.use(exspress.json());
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post("/api/games", validateChoice, (req, res) => {
  res.status(201).json({
    ok: true,
    playerChoise: req.body.playerChoise
  });
});

app.listen(port, () => {
  console.log("stein saks papir ${port}")
});
