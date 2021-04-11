const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Blockchain = require('./app/blockchain');
const TransactionPool = require('./app/transactionPool');
const Wallet = require('./app/wallet');
const PubSub = require('./app/pubsub');
const TransactionMiner = require('./app/transactionMiner');

const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const pubsub = new PubSub({ blockchain, transactionPool });
const transactionMiner = new TransactionMiner({
  blockchain,
  transactionPool,
  wallet,
  pubsub
});

const DEFAULT_PORT = 5000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

app.use(express.json());
app.use(cors());

app.get('/api/blocks', (req, res, next) => {
  res.status(200).json(blockchain.chain.slice().reverse());
});

app.post('/api/transactions', (req, res, next) => {
  const { recipient, amount } = req.body;
  let transaction = transactionPool.existingTransaction({
    inputAddress: wallet.publicKey
  });

  try {
    if (transaction) {
      transaction.update({ senderWallet: wallet, recipient, amount });
    } else {
      transaction = wallet.createTransaction({
        amount,
        recipient,
        chain: blockchain.chain
      });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  transactionPool.setTransaction(transaction);

  pubsub.broadcastTransaction(transaction);

  res.status(201).json({ transaction });
});

app.get('/api/transactions', (req, res, next) => {
  res.status(200).json(transactionPool.transactionMap);
});

app.post('/api/transactions/mine', (req, res, next) => {
  transactionMiner.mineTransactions();

  res.redirect('/api/blocks');
});

app.get('/api/wallet', (req, res, next) => {
  const address = wallet.publicKey;

  res.json({
    address,
    balance: Wallet.calculateBalance({
      chain: blockchain.chain,
      address
    })
  });
});

app.get('/api/addresses', (req, res, next) => {
  const addressesMap = {};

  for (const block of blockchain.chain) {
    for (const transaction of block.data) {
      const recipients = Object.keys(transaction.outputMap);

      recipients.forEach(
        (recipient) =>
          recipient !== wallet.publicKey &&
          (addressesMap[recipient] = recipient)
      );
    }
  }

  res.status(200).json(Object.keys(addressesMap));
});

const syncWithRootState = async () => {
  try {
    const resChain = await axios.get(`${ROOT_NODE_ADDRESS}/api/blocks`);
    const resPoolMap = await axios.get(
      `${ROOT_NODE_ADDRESS}/api/transaction-pool-map`
    );

    const rootChain = resChain.data;
    const rootPoolMap = resPoolMap.data;

    console.log('Replace chain on a sync with', rootChain);
    blockchain.replaceChain(rootChain);
    console.log('Replace trnsaction pool map on a sync with', rootPoolMap);
    transactionPool.setMap(rootPoolMap);
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
    await syncWithRootState();
  }
});
