import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
// Usar URL relativa em produção, ou variável de ambiente em desenvolvimento
const getApiBaseUrl = () => {
  // Em produção no Vercel, usar URL relativa
  if (import.meta.env.PROD) {
    return ""; // URL relativa - mesma origem
  }
  // Em desenvolvimento, usar variável de ambiente ou padrão
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }
  return "http://localhost:3001";
};

const FINAL_API_BASE_URL = getApiBaseUrl();

const translations = {
  en: {
    brandTagline: "Real-time crypto market",
    heroTitle: "Dynamic tracking of the leading cryptocurrencies",
    heroSubtitle:
      "Real-time statistics with instant search and a cap of 10 assets per query.",
    searchPlaceholder: "Search for a coin (e.g. bitcoin, solana, cardano)",
    searchAction: "Search",
    loading: "Loading real-time data...",
    empty: "No coins found. Adjust the search and try again.",
    percent24h: "24h %",
    marketCap: "Market Cap",
    volume24h: "Volume (24h)",
    supply: "Supply",
    tableAsset: "Asset",
    priceUsd: "Price (USD)",
    footerNote: "Data provided by CoinGecko.",
    footerCopy: "© 2025 Emerson Covane",
    themeLabelDark: "Switch to light mode",
    themeLabelLight: "Switch to dark mode",
    languageLabel: "Switch language",
    spotlightLabel: "Highlighted coins",
    connectError: "Unable to load real-time data.",
    coinDetails: "Coin Details",
    close: "Close",
    price: "Price",
    volume: "Volume (24h)",
    circulatingSupply: "Circulating Supply",
    totalSupply: "Total Supply",
    maxSupply: "Max Supply",
    allTimeHigh: "All-Time High",
    allTimeLow: "All-Time Low",
    priceChange24h: "24h Price Change",
    priceChart24h: "24h Price Chart",
    loadingDetails: "Loading details...",
    errorDetails: "Failed to load coin details.",
    sortBy: "Sort by",
    sortPrice: "Price",
    sortMarketCap: "Market Cap",
    sortVolume: "Volume",
    sortChange: "24h Change",
    sortName: "Name",
    ascending: "Ascending",
    descending: "Descending",
  },
  pt: {
    brandTagline: "Mercado cripto em tempo real",
    heroTitle: "Monitoramento dinâmico das principais criptomoedas",
    heroSubtitle:
      "Estatísticas atualizadas em tempo real, com busca rápida e limite de 10 ativos por consulta.",
    searchPlaceholder: "Busque por uma moeda (ex: bitcoin, solana, cardano)",
    searchAction: "Buscar",
    loading: "Carregando dados em tempo real...",
    empty: "Nenhuma moeda encontrada. Ajuste a busca e tente novamente.",
    percent24h: "24h %",
    marketCap: "Market Cap",
    volume24h: "Volume (24h)",
    supply: "Supply",
    tableAsset: "Ativo",
    priceUsd: "Preço (USD)",
    footerNote: "Dados providos por CoinGecko.",
    footerCopy: "© 2025 Emerson Covane",
    themeLabelDark: "Ativar modo claro",
    themeLabelLight: "Ativar modo escuro",
    languageLabel: "Alternar idioma",
    spotlightLabel: "Moedas em destaque",
    connectError: "Não foi possível carregar os dados.",
    coinDetails: "Detalhes da Moeda",
    close: "Fechar",
    price: "Preço",
    volume: "Volume (24h)",
    circulatingSupply: "Oferta Circulante",
    totalSupply: "Oferta Total",
    maxSupply: "Oferta Máxima",
    allTimeHigh: "Máxima Histórica",
    allTimeLow: "Mínima Histórica",
    priceChange24h: "Variação 24h",
    priceChart24h: "Gráfico de Preço 24h",
    loadingDetails: "Carregando detalhes...",
    errorDetails: "Falha ao carregar detalhes da moeda.",
    sortBy: "Ordenar por",
    sortPrice: "Preço",
    sortMarketCap: "Market Cap",
    sortVolume: "Volume",
    sortChange: "Variação 24h",
    sortName: "Nome",
    ascending: "Crescente",
    descending: "Decrescente",
  },
};

function App() {
  const [coins, setCoins] = useState([]);
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("en");
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [coinDetails, setCoinDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortOrder, setSortOrder] = useState("desc");
  const socketRef = useRef(null);
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  const texts = translations[language];

  // Função para buscar moedas via HTTP (usado em produção no Vercel)
  const fetchCoinsViaHttp = useCallback(async (searchTerm = "") => {
    try {
      const apiUrl = import.meta.env.PROD
        ? `/api/coins${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`
        : `${FINAL_API_BASE_URL}/api${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ""}`;
      const response = await axios.get(apiUrl);
      if (Array.isArray(response.data)) {
        setCoins(response.data.slice(0, 10));
        setError("");
      }
    } catch (error) {
      console.error("Erro ao buscar moedas:", error);
      setError(texts.connectError);
    } finally {
      setLoading(false);
    }
  }, [texts.connectError]);

  useEffect(() => {
    // Em produção no Vercel, usar polling HTTP ao invés de WebSocket
    if (import.meta.env.PROD) {
      setLoading(true);
      fetchCoinsViaHttp();
      // Atualizar a cada 20 segundos
      const interval = setInterval(() => {
        fetchCoinsViaHttp(query);
      }, 20000);
      return () => clearInterval(interval);
    }

    // Em desenvolvimento, usar Socket.io
    if (!FINAL_API_BASE_URL) {
      setError("API_BASE_URL não configurada. Verifique as variáveis de ambiente.");
      setLoading(false);
      return;
    }

    console.log("Conectando ao servidor:", FINAL_API_BASE_URL);
    const socket = io(FINAL_API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    setLoading(true);

    socket.on("connect", () => {
      console.log("Socket conectado!");
      setError("");
      socket.emit("requestCoins");
    });

    socket.on("connect_error", (error) => {
      console.error("Erro de conexão:", error);
      setLoading(false);
      setError(
        language === "en"
          ? "Failed to connect to server. Please check your connection."
          : "Falha ao conectar ao servidor. Verifique sua conexão."
      );
    });

    socket.on("coinsData", (data) => {
      console.log("Dados recebidos:", data);
      setLoading(false);
      setError("");
      if (Array.isArray(data)) {
        setCoins(data.slice(0, 10));
      } else {
        setCoins([]);
        setError(
          language === "en"
            ? "Invalid data format received."
            : "Formato de dados inválido recebido."
        );
      }
    });

    socket.on("coinsError", (message) => {
      console.error("Erro do servidor:", message);
      setLoading(false);
      setError(message || texts.connectError);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket desconectado:", reason);
      setError(
        language === "en"
          ? "Connection lost. Reconnecting..."
          : "Conexão perdida. Tentando reconectar..."
      );
    });

    return () => {
      console.log("Desconectando socket...");
      socket.disconnect();
    };
  }, [language, texts.connectError, fetchCoinsViaHttp, query]);

  const fetchSuggestions = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const apiUrl = import.meta.env.PROD 
        ? `/api/suggestions?q=${encodeURIComponent(searchTerm)}`
        : `${FINAL_API_BASE_URL}/api/suggestions?q=${encodeURIComponent(searchTerm)}`;
      
      console.log("Fetching suggestions from:", apiUrl);
      const response = await axios.get(apiUrl);
      console.log("Suggestions response:", response.data);
      
      // Garantir que sempre seja um array
      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        // Normalizar os dados para garantir que tenham image/thumb
        const normalizedSuggestions = data.map((item) => ({
          id: item.id,
          name: item.name,
          symbol: item.symbol,
          image: item.image || item.thumb || '',
        }));
        console.log("Normalized suggestions:", normalizedSuggestions);
        setSuggestions(normalizedSuggestions);
        setShowSuggestions(true);
      } else {
        console.log("No suggestions found or empty array");
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      console.error("Error details:", error.response?.data || error.message);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Debounce para sugestões enquanto o usuário digita
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log("Debounce triggered, fetching suggestions for:", query);
      fetchSuggestions(query);
    }, 300); // Aguarda 300ms após parar de digitar

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]); // fetchSuggestions é estável, não precisa estar nas dependências

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (event) => {
    event.preventDefault();
    setShowSuggestions(false);
    setLoading(true);
    
    if (import.meta.env.PROD) {
      // Em produção, usar HTTP
      fetchCoinsViaHttp(query.trim());
    } else {
      // Em desenvolvimento, usar Socket.io
      if (socketRef.current) {
        socketRef.current.emit("searchCoins", query.trim());
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.name);
    setShowSuggestions(false);
    setLoading(true);
    
    if (import.meta.env.PROD) {
      // Em produção, usar HTTP
      fetchCoinsViaHttp(suggestion.id);
    } else {
      // Em desenvolvimento, usar Socket.io
      if (socketRef.current) {
        socketRef.current.emit("searchCoins", suggestion.id);
      }
    }
  };

  const resetSearch = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    
    if (import.meta.env.PROD) {
      // Em produção, usar HTTP
      fetchCoinsViaHttp("");
    } else {
      // Em desenvolvimento, usar Socket.io
      if (socketRef.current) {
        socketRef.current.emit("searchCoins", "");
      }
    }
  };

  const fetchCoinDetails = async (coinId) => {
    setLoadingDetails(true);
    setErrorDetails("");
    try {
      const apiUrl = import.meta.env.PROD
        ? `/api/coin/${coinId}`
        : `${FINAL_API_BASE_URL}/api/coin/${coinId}`;
      const response = await axios.get(apiUrl);
      setCoinDetails(response.data);
    } catch {
      setErrorDetails(texts.errorDetails);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCoinClick = (coin) => {
    setSelectedCoin(coin);
    fetchCoinDetails(coin.id);
  };

  const closeModal = () => {
    setSelectedCoin(null);
    setCoinDetails(null);
  };

  const sortedCoins = useMemo(() => {
    const sorted = [...coins];
    sorted.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case "price":
          aValue = a.current_price || 0;
          bValue = b.current_price || 0;
          break;
        case "market_cap":
          aValue = a.market_cap || 0;
          bValue = b.market_cap || 0;
          break;
        case "volume":
          aValue = a.total_volume || 0;
          bValue = b.total_volume || 0;
          break;
        case "change":
          aValue = a.price_change_percentage_24h || 0;
          bValue = b.price_change_percentage_24h || 0;
          break;
        case "name":
          aValue = a.name?.toLowerCase() || "";
          bValue = b.name?.toLowerCase() || "";
          break;
        default:
          return 0;
      }
      if (sortBy === "name") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
    return sorted;
  }, [coins, sortBy, sortOrder]);

  const formatChartData = (priceHistory) =>
    Array.isArray(priceHistory)
      ? priceHistory.map(([timestamp, price]) => ({
          time: new Date(timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          price,
        }))
      : [];

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="header">
        <div className="brand">
          <span className="brand-name">CryptoPulse</span>
        </div>
        <div className="controls">
          <button
            className="language-toggle"
            onClick={() => setLanguage(language === "en" ? "pt" : "en")}
            aria-label={texts.languageLabel}
          >
            {language === "en" ? "🇺🇸" : "🇧🇷"}
          </button>
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? texts.themeLabelDark : texts.themeLabelLight}
          >
            {darkMode ? "🌞" : "🌙"}
          </button>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1 className="title">{texts.heroTitle}</h1>
          <p className="subtitle">{texts.heroSubtitle}</p>

          <form className="search" onSubmit={handleSearch}>
            <div className="search-wrapper">
              <div className="search-field">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={texts.searchPlaceholder}
                  value={query}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuery(value);
                    // O debounce no useEffect cuidará das sugestões
                  }}
                  onFocus={() => {
                    if (query && query.trim().length >= 2) {
                      if (Array.isArray(suggestions) && suggestions.length > 0) {
                        setShowSuggestions(true);
                      } else {
                        // Se não há sugestões mas há query, buscar novamente
                        fetchSuggestions(query);
                      }
                    }
                  }}
                />
                {query && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={resetSearch}
                  >
                    ×
                  </button>
                )}
              </div>
              {showSuggestions && Array.isArray(suggestions) && suggestions.length > 0 && (
                <div className="suggestions-dropdown" ref={suggestionsRef}>
                  {suggestions.map((suggestion) => {
                    const imageUrl = suggestion.image || suggestion.thumb || '';
                    return (
                      <button
                        key={suggestion.id || `${suggestion.name}-${suggestion.symbol}`}
                        type="button"
                        className="suggestion-item"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {imageUrl && (
                          <img 
                            src={imageUrl} 
                            alt={suggestion.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="suggestion-info">
                          <span className="suggestion-name">{suggestion.name || 'Unknown'}</span>
                          <span className="suggestion-symbol">
                            {(suggestion.symbol || '').toUpperCase()}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="submit" className="search-submit">{texts.searchAction}</button>
          </form>
        </section>

        {loading && <p className="loading">{texts.loading}</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && sortedCoins.length === 0 && (
          <p className="empty-state">{texts.empty}</p>
        )}

        {!loading && !error && sortedCoins.length > 0 && (
          <section className="table-section">
            <div className="table-controls">
              <div className="sort-controls">
                <label htmlFor="sort-select">{texts.sortBy}:</label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="market_cap">{texts.sortMarketCap}</option>
                  <option value="price">{texts.sortPrice}</option>
                  <option value="volume">{texts.sortVolume}</option>
                  <option value="change">{texts.sortChange}</option>
                  <option value="name">{texts.sortName}</option>
                </select>
                <button
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  aria-label={sortOrder === "asc" ? texts.descending : texts.ascending}
                >
                  {sortOrder === "asc" ? "↑" : "↓"}
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="crypto-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{texts.tableAsset}</th>
                    <th>{texts.priceUsd}</th>
                    <th>{texts.percent24h}</th>
                    <th>{texts.marketCap}</th>
                    <th>{texts.volume24h}</th>
                    <th>{texts.supply}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCoins.map((coin, index) => (
                    <tr key={coin.id} onClick={() => handleCoinClick(coin)} className="coin-row">
                      <td data-label="#">{index + 1}</td>
                      <td className="coin-name" data-label={texts.tableAsset}>
                        <img src={coin.image} alt={coin.name} />
                        <div className="coin-meta">
                          <span className="coin-full-name">{coin.name}</span>
                          <span className="coin-code">{coin.symbol.toUpperCase()}</span>
                        </div>
                      </td>
                      <td data-label={texts.priceUsd}>
                        ${coin.current_price?.toLocaleString() ?? "-"}
                      </td>
                      <td
                        data-label={texts.percent24h}
                        className={
                          coin.price_change_percentage_24h < 0 ? "negative" : "positive"
                        }
                      >
                        {coin.price_change_percentage_24h?.toFixed(2) ?? "0.00"}%
                      </td>
                      <td data-label={texts.marketCap}>
                        ${coin.market_cap?.toLocaleString() ?? "-"}
                      </td>
                      <td data-label={texts.volume24h}>
                        ${coin.total_volume?.toLocaleString() ?? "-"}
                      </td>
                      <td data-label={texts.supply}>
                        {coin.circulating_supply
                          ? coin.circulating_supply.toLocaleString()
                          : "-"}{" "}
                        {coin.symbol?.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
        
      <footer className="footer">
        <p><a href="https://github.com/emers0n15" target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted-dark)", textDecoration: "none" }}>{texts.footerCopy}</a></p>
      </footer>

      {selectedCoin && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-section">
                <img
                  src={selectedCoin.image}
                  alt={selectedCoin.name}
                  className="modal-coin-image"
                />
                <div>
                  <h2 className="modal-title">{selectedCoin.name}</h2>
                  <p className="modal-symbol">{selectedCoin.symbol.toUpperCase()}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {loadingDetails ? (
                <div className="modal-loading">{texts.loadingDetails}</div>
              ) : errorDetails ? (
                <div className="modal-error">{errorDetails}</div>
              ) : coinDetails ? (
                <>
                  <div className="coin-stats-grid">
                    <div className="stat-card">
                      <span className="stat-label">{texts.price}</span>
                      <span className="stat-value">
                        ${coinDetails.market_data?.current_price?.usd?.toLocaleString() ?? "-"}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">{texts.priceChange24h}</span>
                      <span className={`stat-value ${
                        (coinDetails.market_data?.price_change_percentage_24h ?? 0) >= 0 ? 'positive' : 'negative'
                      }`}>
                        {(coinDetails.market_data?.price_change_percentage_24h ?? 0) >= 0 ? '+' : ''}
                        {coinDetails.market_data?.price_change_percentage_24h?.toFixed(2) ?? "-"}%
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">{texts.volume}</span>
                      <span className="stat-value">
                        ${coinDetails.market_data?.total_volume?.usd?.toLocaleString() ?? "-"}
                      </span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">{texts.marketCap}</span>
                      <span className="stat-value">
                        ${coinDetails.market_data?.market_cap?.usd?.toLocaleString() ?? "-"}
                      </span>
                    </div>
                  </div>
                  {coinDetails.priceHistory24h && (
                    <div className="chart-container">
                      <h3 className="chart-title">{texts.priceChart24h}</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={formatChartData(coinDetails.priceHistory24h)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="price" stroke="#4facfe" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
