// Serverless function for coins list endpoint
import axios from "axios";

const coingeckoMarkets = axios.create({
  baseURL: "https://api.coingecko.com/api/v3/coins/markets",
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "CryptoPulse/1.0",
    ...(process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
      : {}),
  },
});

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

const DEFAULT_LIMIT = 10;

const fetchCoinsFromApi = async (trimmedSearch = "") => {
  if (!trimmedSearch) {
    const { data } = await coingeckoMarkets.get("", {
      params: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: DEFAULT_LIMIT,
        page: 1,
        sparkline: false,
        price_change_percentage: "1h,24h,7d",
      },
    });
    return Array.isArray(data) ? data.slice(0, DEFAULT_LIMIT) : [];
  }

  const { data: searchData } = await coingeckoSearch.get("", {
    params: { query: trimmedSearch },
  });

  const ids = Array.from(
    new Set((searchData?.coins || []).map((coin) => coin.id))
  ).slice(0, DEFAULT_LIMIT);

  if (!ids.length) return [];

  const { data } = await coingeckoMarkets.get("", {
    params: {
      vs_currency: "usd",
      ids: ids.join(","),
      order: "market_cap_desc",
      per_page: ids.length,
      sparkline: false,
      price_change_percentage: "1h,24h,7d",
    },
  });

  const sorted = Array.isArray(data)
    ? data
        .filter((coin) => ids.includes(coin.id))
        .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .slice(0, DEFAULT_LIMIT)
    : [];

  return sorted;
};

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
    const searchTerm = (req.query || {}).search || "";
    const data = await fetchCoinsFromApi(searchTerm.trim().toLowerCase());
    res.json(data);
  } catch (error) {
    console.error("Error fetching coins:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
}

