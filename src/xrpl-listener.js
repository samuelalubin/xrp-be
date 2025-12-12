require('dotenv').config();
const xrpl = require('xrpl');
const Deposit = require('./models/deposit.model');
const DestinationMapping = require('./models/destinationMapping.model');
const User = require('./models/user.model');
const { DEPOSIT_WALLET_ADDRESS, XRPL_SERVER } = process.env;
const { getIO } = require('./socket');
const { Company } = require('./models');

const getXrpUsdPrice = async () => {
  // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd');
  const response = await fetch(
    'https://min-api.cryptocompare.com/data/pricemulti?fsyms=XRP&tsyms=USD&api_key=cac4cc4bdd9088646112252cc2cab4eebe9c927483b7a93d8f77d5f83e464151'
  );
  const data = await response.json();
  // return data.ripple.usd; // price in USD
  return data.XRP.USD; // price in USD
};
const calculateFees = async (xrpAmount) => {
  const xrpUsdPrice = await getXrpUsdPrice();
  const company = await Company.findOne();

  // 0.15% fee in XRP
  const percentageFeeXrp = xrpAmount * (company.transactionFeePercentage / 100);
  // console.log(percentageFeeXrp, 'xrpUsdPrice');
  // Minimum fee $0.95 converted to XRP
  // const minFeeXrp = 0.95 / xrpUsdPrice;
  const minFeeXrp = company.transactionFee / xrpUsdPrice;
  console.log(minFeeXrp, 'xrpUsdPrice');

  // Pick the larger fee
  const feeXrp = Math.max(percentageFeeXrp, minFeeXrp);
  console.log(feeXrp, 'xrpUsdPrice');
  console.log(xrpAmount - feeXrp, 'xrpUsdPrice');

  return {
    // xrpUsdPrice,
    transactionFees: feeXrp,
    buyingFees: xrpAmount - feeXrp,
    // feeInUsd: feeXrp * xrpUsdPrice
  };
};

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
      // const destinationTag = t.DestinationTag ?? null;
      const destinationTag = t.DestinationTag ?? 1000;

      let userId = null;
      if (destinationTag !== null) {
        const mapping = await DestinationMapping.findOne({ destinationTag });
        if (mapping) userId = mapping.userId;
      }

      const exists = await Deposit.findOne({ txId });
      console.log('1111111');
      console.log(exists, '1111111');
      if (exists) {
        console.log('ddddddddddddddd');
        const { transactionFees, buyingFees } = await calculateFees(amountXRP);
        console.log(transactionFees, buyingFees, 'ddddddddddddddd1');

        exists.transactionFees = transactionFees;
        await exists.save();
        console.log(exists);
        const user = await User.findOne({ destinationTag });
        user.totalAmount -= Number(amountXRP);
        user.totalAmountDrops -= Number(amountXRP * 1_000_000);
        user.totalAmount += Number(buyingFees);
        user.totalAmountDrops += Number(buyingFees * 1_000_000);
        await user.save();
        const c2 = await User.findOneAndUpdate(
          { role: 'admin' },
          { $inc: { totalAmount: transactionFees, totalAmountDrops: transactionFees * 1_000_000 } }
        );
        console.log(user);
        if (user) {
          console.log(user._id);
          getIO().emit(`xrpReceived${user._id}`, user);
        }
      } else {
        console.log('2222222');
        const { transactionFees, buyingFees } = await calculateFees(amountXRP);
        console.log(transactionFees, buyingFees, 'ddddddddddddddd2');

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
          transactionFees: transactionFees,
        });

        await deposit.save();
        console.log('💰 New deposit', txId, 'amount', amountXRP, 'tag', destinationTag);
        // const user2 = await User.findOne({ destinationTag });
        // console.log(user2, amountXRP, drops);

        const user = await User.findOneAndUpdate(
          { destinationTag },
          { $inc: { totalAmount: buyingFees, totalAmountDrops: buyingFees * 1_000_000 } }
        );
        const c2 = await User.findOneAndUpdate(
          { role: 'admin' },
          { $inc: { totalAmount: transactionFees, totalAmountDrops: transactionFees * 1_000_000 } }
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
