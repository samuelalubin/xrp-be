const xrpl = require('xrpl');
const axios = require('axios');

// XRP Mainnet URL
const XRPL_NETWORK = 'wss://s1.ripple.com';

// The live secret you provided (replace with caution in production)
const HOT_WALLET_SEED = 'snLgRjhWdz1gqtV4ymss3puBK3Ncd';

// Function to get XRP to USD price using axios
const getXrpUsdPrice = async () => {
  try {
    const response = await axios.get(
      'https://min-api.cryptocompare.com/data/pricemulti?fsyms=XRP&tsyms=USD&api_key=cac4cc4bdd9088646112252cc2cab4eebe9c927483b7a93d8f77d5f83e464151'
    );
    return response.data.XRP.USD; // price in USD
  } catch (err) {
    console.error('Error fetching XRP/USD price:', err);
    throw new Error('Failed to fetch XRP price');
  }
};

// Function to get wallet for signing
const getWallet = async () => {
  if (!HOT_WALLET_SEED) throw new Error('XRPL_SEED not set');
  return xrpl.Wallet.fromSeed(HOT_WALLET_SEED);
};

// Connect to XRP Ledger client
const connectXRPL = async () => {
  const client = new xrpl.Client(XRPL_NETWORK);
  await client.connect();
  console.log('✅ Connected to XRP Ledger');
  return client;
};

// Function to buy "PHNIX" token
const buyToken = async () => {
  try {
    const client = await connectXRPL();
    const wallet = await getWallet();
    const xrpUsdPrice = await getXrpUsdPrice();

    // Get equivalent XRP for $1
    const xrpAmount = 1 / xrpUsdPrice; // Convert $1 to XRP based on price

    console.log(`Buying token with ${xrpAmount} XRP...`);

    // Define the token's issuer and currency
    const tokenCurrency = 'PHNIX';
    const tokenIssuer = 'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN';
    const roundedXrp = Number(xrpAmount.toFixed(6));

    // Prepare the buy offer
    const buyOffer = {
      TransactionType: 'OfferCreate',
      Account: wallet.address,
      TakerGets: xrpl.xrpToDrops(String(roundedXrp)), // XRP to buy token
      TakerPays: {
        currency: tokenCurrency,
        issuer: tokenIssuer,
        value: xrpAmount.toFixed(6), // Amount of PHNIX token we want to buy
      },
    };

    // Autofill and sign the transaction
    const prepared = await client.autofill(buyOffer);
    const signed = wallet.sign(prepared);

    // Submit the transaction
    const txResult = await client.submitAndWait(signed.tx_blob);
    const txHash = signed.hash;

    console.log('Transaction Hash:', txHash);
    console.log('Transaction Result:', txResult);

    // Check the status of the transaction
    if (txResult.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log('✅ Token purchase successful!');
    } else {
      console.log('❌ Transaction failed:', txResult.result.meta.TransactionResult);
    }

    // Disconnect from the client
    await client.disconnect();
  } catch (err) {
    console.error('Error during buy operation:', err);
  }
};

// Call the buy function to perform the purchase
buyToken();
