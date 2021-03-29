const express = require('express');
const axios = require('axios');
const Blockchain = require('./blockchain');
const PubSub = require('./app/pubsub');

const app = express();
const blockchain = new Blockchain();
const pubsub = new PubSub({ blockchain });

const DEFAULT_PORT = 5000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

app.use(express.json());

app.get('/api/blocks', (req, res, next) => {
  res.status(200).json(blockchain.chain);
});

app.post('/api/mine', (req, res, next) => {
  const { data } = req.body;
  blockchain.addBlock({ data });

  pubsub.broadcastChain();

  res.status(201).redirect('/api/blocks');
});

const syncChains = async () => {
  try {
    const res = await axios.get(`${ROOT_NODE_ADDRESS}/api/blocks`);

    const rootChain = res.data;

    console.log('Replace chain on a sync with', rootChain);
    blockchain.replaceChain(rootChain);
  } catch (error) {
    console.log(error);
  }
};

let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === 'true') {
  PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
}

const PORT = PEER_PORT || DEFAULT_PORT;

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);

  if (PORT !== DEFAULT_PORT) {
    await syncChains();
  }
});
