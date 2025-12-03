import axios from 'axios';

const API_KEY = 'kIycfuspYMcBRGESZMShvAIdRrlOLDWE'; // use your client key here
const BASE_URL = 'https://api.1inch.dev/swap/v6.0/1'; // 1 = Ethereum chain ID

async function test1inchAPI() {
  try {
    // Example: quote ETH -> USDC
    const fromTokenAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // ETH
    const toTokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC

    const res = await axios.get(`${BASE_URL}/quote`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      params: {
        fromTokenAddress,
        toTokenAddress,
        amount: (0.01 * 1e18).toString(), // 0.01 ETH
      },
    });

    console.log('✅ 1inch API Response OK:');
    console.log(res.data);
  } catch (err) {
    console.error('❌ 1inch API test failed:', err.response?.data || err.message);
  }
}

test1inchAPI();
