const express = require('express');
const Blockchain = require('./blockchain');

const app = express();
const blockchain = new Blockchain();

app.use(express.json());

app.get('/api/blocks', (req, res, next) => {
  res.status(200).json(blockchain.chain);
});

app.post('/api/mine', (req, res, next) => {
  const { data } = req.body;
  blockchain.addBlock({ data });

  res.status(201).redirect('/api/blocks');
});

const PORT = 5000;

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
