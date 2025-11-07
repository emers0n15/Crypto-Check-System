import express from "express";
import axios from "axios";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;
const DEFAULT_LIMIT = 10;
const REFRESH_INTERVAL_MS = 20000;
const CACHE_TTL_MS = 25000;
const TOP_COINS_ROOM = "top-coins";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Configuração da API CoinGecko
const coingeckoMarkets = axios.create({
  baseURL: "https://api.coingecko.com/api/v3/coins/markets",
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "CryptoPulse/1.0 (+https://github.com/emers0n15)",
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
    "User-Agent": "CryptoPulse/1.0 (+https://github.com/emers0n15)",
    ...(process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
      : {}),
  },
});

const coingeckoCoin = axios.create({
  baseURL: "https://api.coingecko.com/api/v3/coins",
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "CryptoPulse/1.0 (+https://github.com/emers0n15)",
    ...(process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY }
      : {}),
  },
});

// ---------------- Cache e Funções de busca ----------------

const searchCache = new Map();
const cacheKey = (term) => (term ? `search:${term}` : "top");

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

const fetchCoins = async (searchTerm = "") => {
  const trimmedSearch = searchTerm.trim().toLowerCase();
  const key = cacheKey(trimmedSearch);
  const now = Date.now();
  const cachedEntry = searchCache.get(key);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.data;
  }

  try {
    const freshData = await fetchCoinsFromApi(trimmedSearch);
    searchCache.set(key, { data: freshData, expiresAt: now + CACHE_TTL_MS });
    return freshData;
  } catch (error) {
    if (cachedEntry) {
      console.warn(`[Cache] Using old data for "${key}"`);
      return cachedEntry.data;
    }
    throw error;
  }
};

// ---------------- Socket.io ----------------

let cachedTopCoins = [];
let isBroadcasting = false;

const broadcastTopCoins = async () => {
  if (isBroadcasting) return;
  isBroadcasting = true;
  try {
    cachedTopCoins = await fetchCoins();
    io.to(TOP_COINS_ROOM).emit("coinsData", cachedTopCoins);
  } catch (error) {
    console.error("[broadcast] Failed:", error.message);
    if (!cachedTopCoins.length) {
      io.emit(
        "coinsError",
        "Could not update live data. Retrying soon."
      );
    } else {
      io.to(TOP_COINS_ROOM).emit("coinsData", cachedTopCoins);
    }
  } finally {
    isBroadcasting = false;
  }
};

io.on("connection", (socket) => {
  socket.emit("coinsData", cachedTopCoins);
  socket.join(TOP_COINS_ROOM);

  let currentSearchTerm = "";
  let searchIntervalId = null;

  const stopSearchInterval = () => {
    if (searchIntervalId) {
      clearInterval(searchIntervalId);
      searchIntervalId = null;
    }
  };

  const sendCoins = async (searchTerm = "") => {
    try {
      const data = await fetchCoins(searchTerm);
      socket.emit("coinsData", data);
    } catch {
      socket.emit("coinsError", "Error loading data");
    }
  };

  socket.on("requestCoins", () => {
    currentSearchTerm = "";
    stopSearchInterval();
    socket.join(TOP_COINS_ROOM);
    if (cachedTopCoins.length) {
      socket.emit("coinsData", cachedTopCoins);
    } else {
      sendCoins();
    }
  });

  socket.on("searchCoins", (term = "") => {
    currentSearchTerm = term.trim();
    if (!currentSearchTerm) {
      stopSearchInterval();
      socket.join(TOP_COINS_ROOM);
      socket.emit("coinsData", cachedTopCoins);
      return;
    }
    socket.leave(TOP_COINS_ROOM);
    stopSearchInterval();
    sendCoins(currentSearchTerm);
    searchIntervalId = setInterval(() => sendCoins(currentSearchTerm), REFRESH_INTERVAL_MS);
  });

  socket.on("disconnect", stopSearchInterval);
});

setInterval(() => broadcastTopCoins(), REFRESH_INTERVAL_MS);
void broadcastTopCoins();

// ---------------- Rotas HTTP ----------------

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "CryptoPulse API" });
});

// Sugestões de moedas (autocomplete)
app.get("/api/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const { data } = await coingeckoSearch.get("", { params: { query: q.trim() } });
    const suggestions = (data?.coins || [])
      .slice(0, 10)
      .map((coin) => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        image: coin.thumb || coin.large || "",
        thumb: coin.thumb || coin.large || "",
      })));
    res.json(suggestions);
  } catch (error) {
    console.error("Error in suggestions endpoint:", error);
    res.json([]);
  }
});

// Lista de moedas
app.get("/api", async (req, res) => {
  try {
    const data = await fetchCoins(req.query.search || "");
    res.json(data);
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
});

// Detalhes de moeda
app.get("/api/coin/:id", async (req, res) => {
  try {
    const { id } = req.params;
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
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.response?.data?.status?.error_message || error.message,
    });
  }
});

// 🔹 Exporta para Vercel (serverless)
export default app;

// 🔹 Executa localmente apenas no dev
if (process.env.NODE_ENV !== "production") {
  server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}
