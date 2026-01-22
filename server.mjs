import express from "express";

const port = 8080;
const app = express();

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log("stein saks papir ${port}")
})
