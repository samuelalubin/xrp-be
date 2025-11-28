require('dotenv').config();
const xrpl = require('xrpl');
const Deposit = require('./models/deposit.model');
const DestinationMapping = require('./models/destinationMapping.model');
const User = require('./models/user.model');
const { DEPOSIT_WALLET_ADDRESS, XRPL_SERVER } = process.env;
const { getIO } = require('./socket');

async function startXRPLListener(mongoose) {
  console.log('kuch bhi 1');
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
      console.log(tx);
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
      console.log('1111111');
      console.log(exists, '1111111');
      if (exists) {
        console.log(exists);
        const user = await User.findOne({ destinationTag });
        console.log(user);
        if (user) {
          console.log(user._id);
          getIO().emit(`xrpReceived${user._id}`, user);
        }
      } else {
        console.log('2222222');

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
        console.log(user);
        if (user) {
          console.log(user._id);
          getIO().emit(`xrpReceived${user._id}`, user);
        }
        if (validated && userId) {
          console.log('✅ Deposit validated for user', userId.toString());
          // TODO: credit user’s balance here
        }
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
