// Serverless function for coin details endpoint
import axios from "axios";

const coingeckoCoin = axios.create({
  baseURL: "https://api.coingecko.com/api/v3/coins",
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "CryptoPulse/1.0",
    ...(process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
      : {}),
  },
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "Coin ID is required" });
    }

    const [coinData, marketChart] = await Promise.all([
      coingeckoCoin.get(`/${id}`, {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false,
          sparkline: false,
        },
      }),
      coingeckoCoin.get(`/${id}/market_chart`, {
        params: { vs_currency: "usd", days: 2 },
      }),
    ]);

    const prices = marketChart.data.prices || [];
    res.json({ ...coinData.data, priceHistory24h: prices });
  } catch (error) {
    console.error("Error fetching coin details:", error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.response?.data?.status?.error_message || error.message,
    });
  }
}

