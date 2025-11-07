// Serverless function for suggestions endpoint
import axios from "axios";

const coingeckoSearch = axios.create({
  baseURL: "https://api.coingecko.com/api/v3/search",
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
    const { q } = req.query || {};
    if (!q || q.trim().length < 2) return res.json([]);
    
    const { data } = await coingeckoSearch.get("", { params: { query: q.trim() } });
    const suggestions = (data?.coins || [])
      .slice(0, 10)
      .map((coin) => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        image: coin.thumb || coin.large || "",
      }));
    
    res.json(suggestions);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.json([]);
  }
}

