// require('dotenv').config();
// const xrpl = require('xrpl');
// const mongoose = require('mongoose');
// const { Deposit, DestinationMapping, User } = require('./models');
// const { DEPOSIT_WALLET_ADDRESS, DEPOSIT_WALLET_SECRET, XRPL_SERVER, MONGO_URI } = process.env;

// async function start() {
//   await mongoose.connect(MONGO_URI, {});
//   console.log('Mongo connected');

//   const client = new xrpl.Client(XRPL_SERVER);
//   await client.connect();
//   console.log('xrpl client connected to', XRPL_SERVER);

//   // Subscribe to account transactions for your deposit address
//   const subscribe = await client.request({
//     command: 'subscribe',
//     accounts: [DEPOSIT_WALLET_ADDRESS],
//   });
//   console.log('Subscribed:', subscribe);

//   client.on('transaction', async (tx) => {
//     try {
//       // tx has: transaction, meta, type (e.g., 'transaction'), validated boolean
//       const t = tx.transaction;
//       const m = tx.meta;
//       const validated = tx.validated === true;

//       // We only care about Payment transactions
//       if (t.TransactionType !== 'Payment') return;

//       // Destination must match
//       if (t.Destination !== DEPOSIT_WALLET_ADDRESS) return;

//       // If token is XRP, Amount is a string number of drops
//       // If non-XRP IssuedCurrency, Amount is an object — we ignore here
//       if (typeof t.Amount !== 'string') {
//         console.log('Non-XRP payment (issued currency) — skipping in this example');
//         return;
//       }

//       const txId = t.hash || t.TransactionHash || t.tx_hash || t.hash; // xrpl.js uses transaction.hash
//       const amountDrops = t.Amount;
//       const amountXRP = (Number(amountDrops) / 1_000_000).toString();
//       const destinationTag = t.DestinationTag ?? null;
//       const source = t.Account ?? null;

//       // Look up user by destinationTag (if present)
//       let userId = null;
//       if (destinationTag !== null) {
//         const mapping = await DestinationMapping.findOne({ destinationTag });
//         if (mapping) userId = mapping.userId;
//       }

//       // Check if we've already recorded this tx
//       const existing = await Deposit.findOne({ txId });
//       if (existing) {
//         console.log('Already exists:', txId);
//         return;
//       }

//       const deposit = new Deposit({
//         txId,
//         userId,
//         amountDrops,
//         amountXRP,
//         source,
//         destination: DEPOSIT_WALLET_ADDRESS,
//         destinationTag,
//         ledgerIndex: tx.ledger_index ?? null,
//         validated,
//         raw: tx,
//       });

//       await deposit.save();
//       console.log('Saved deposit', txId, 'amount', amountXRP, 'destTag', destinationTag);

//       // Optionally, if validated and user exists, credit user account business logic here.
//       if (validated && userId) {
//         // e.g., mark as confirmed and call internal wallet/credit system
//         console.log('Deposit validated for user', userId.toString());
//         // TODO: call your "credit user" function here
//       }
//     } catch (err) {
//       console.error('Error handling tx event', err);
//     }
//   });

//   client.on('disconnected', (code) => {
//     console.log('XRPL client disconnected', code);
//     // Implement reconnect logic in production
//   });
// }

// start().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

// xrpl-listener.js
// ______________________________

require('dotenv').config();
const xrpl = require('xrpl');
const Deposit = require('./models/deposit.model');
const DestinationMapping = require('./models/destinationMapping.model');
const User = require('./models/user.model');
const { DEPOSIT_WALLET_ADDRESS, XRPL_SERVER } = process.env;

async function startXRPLListener(mongoose) {
  const client = new xrpl.Client(XRPL_SERVER);
  await client.connect();
  console.log('XRPL client connected to', XRPL_SERVER);

  // Subscribe to your deposit wallet
  await client.request({
    command: 'subscribe',
    accounts: [DEPOSIT_WALLET_ADDRESS],
  });

  console.log('Subscribed to XRPL account:', DEPOSIT_WALLET_ADDRESS);

  client.on('transaction', async (tx) => {
    try {
      const t = tx.tx_json;
      const validated = tx.validated === true;
      if (t.TransactionType !== 'Payment') return;
      if (t.Destination !== DEPOSIT_WALLET_ADDRESS) return;
      let drops = null;
      if (typeof t.Amount === 'string') {
        drops = t.Amount;
      } else if (tx.meta?.delivered_amount) {
        drops = tx.meta.delivered_amount;
      }

      if (!drops) {
        console.log('No XRP amount found');
        return;
      }
      const txId = tx.hash || t.TransactionHash;
      const amountXRP = (Number(drops) / 1_000_000).toString();
      console.log(amountXRP);
      const destinationTag = t.DestinationTag ?? null;

      let userId = null;
      if (destinationTag !== null) {
        const mapping = await DestinationMapping.findOne({ destinationTag });
        if (mapping) userId = mapping.userId;
      }

      const exists = await Deposit.findOne({ txId });
      if (exists) return;

      const deposit = new Deposit({
        txId,
        userId,
        amountXRP,
        amountDrops: drops,
        source: t.Account,
        destination: DEPOSIT_WALLET_ADDRESS,
        destinationTag,
        validated,
        raw: tx,
      });

      await deposit.save();
      console.log('💰 New deposit', txId, 'amount', amountXRP, 'tag', destinationTag);
      const user2 = await User.findOne({ destinationTag });
      console.log(user2, amountXRP, drops);

      const user = await User.findOneAndUpdate(
        { destinationTag },
        { $inc: { totalAmount: amountXRP, totalAmountDrops: drops } }
      );

      if (validated && userId) {
        console.log('✅ Deposit validated for user', userId.toString());
        // TODO: credit user’s balance here
      }
    } catch (err) {
      console.error('Listener error:', err);
    }
  });

  client.on('disconnected', (code) => {
    console.log('XRPL client disconnected', code);
  });
}

module.exports = { startXRPLListener };
