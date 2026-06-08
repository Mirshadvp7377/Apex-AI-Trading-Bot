import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { 
  Terminal, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, Send,
  Plus, Edit, MoreHorizontal, Bell, History, BarChart2, Eye, EyeOff, Trash2, Lock, Unlock, Magnet, Ruler, Type, Slash, Crosshair, MousePointer,
  ChevronRight, Play
} from 'lucide-react';

// Custom Candlestick shape renderer for Recharts
const Candlestick = (props) => {
  const { x, y, width, height, payload } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  const { open, close, high, low } = payload;
  
  const isUp = close >= open;
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  const fillColor = isUp ? '#10b981' : '#ef4444'; // Filled bodies

  const bodyHeight = Math.abs(open - close) || 0.01;
  const pixelsPerUnit = height / bodyHeight;
  const highY = y - (high - Math.max(open, close)) * pixelsPerUnit;
  const lowY = y + height + (Math.min(open, close) - low) * pixelsPerUnit;
  const centerX = x + width / 2;

  return (
    <g>
      {/* Wick (High-Low line) */}
      <line x1={centerX} y1={highY} x2={centerX} y2={lowY} stroke={strokeColor} strokeWidth={1.5} />
      {/* Body (Open-Close rect) */}
      <rect x={x} y={y} width={width} height={height} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
    </g>
  );
};

export default function TradeTerminal({ portfolio, fetchPortfolio }) {
  const [symbol, setSymbol] = useState(portfolio.active_symbol || 'BTC-USD');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState('0.1');
  const [price, setPrice] = useState('0.0');
  const [priceHistory, setPriceHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [updatingSymbol, setUpdatingSymbol] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('trade');
  const [selectedDrawingTool, setSelectedDrawingTool] = useState('crosshair');
  const consoleEndRef = useRef(null);

  // Poll logs and current price history
  useEffect(() => {
    fetchLogs();
    fetchPriceData();
    const interval = setInterval(() => {
      fetchLogs();
      fetchPriceData();
    }, 4000);
    return () => clearInterval(interval);
  }, [symbol]);

  // Generate simulated order book ticks
  useEffect(() => {
    const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].close : 65000.0;
    generateOrderBook(currentPrice);

    const interval = setInterval(() => {
      generateOrderBook(currentPrice);
    }, 1500);

    return () => clearInterval(interval);
  }, [priceHistory]);

  const generateOrderBook = (midPrice) => {
    const bids = [];
    const asks = [];
    for (let i = 1; i <= 5; i++) {
      const bidPrice = midPrice * (1 - (0.00015 * i)) * (1 + (Math.random() - 0.5) * 0.0001);
      const askPrice = midPrice * (1 + (0.00015 * i)) * (1 + (Math.random() - 0.5) * 0.0001);
      
      bids.push({
        price: bidPrice,
        size: Math.random() * 2.5 + 0.1,
        total: 0
      });
      asks.push({
        price: askPrice,
        size: Math.random() * 2.5 + 0.1,
        total: 0
      });
    }

    // Sort asks descending, bids descending
    asks.sort((a, b) => b.price - a.price);
    bids.sort((a, b) => b.price - a.price);

    // Compute cumulative totals
    let bidTotal = 0;
    bids.forEach(b => { bidTotal += b.size; b.total = bidTotal; });
    let askTotal = 0;
    asks.forEach(a => { askTotal += a.size; a.total = askTotal; });

    setOrderBook({ bids, asks });
  };

  const fetchLogs = async () => {
    try {
      const r = await fetch('/api/logs');
      if (r.ok) {
        const d = await r.json();
        setLogs(d.logs);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  };

  const fetchPriceData = async () => {
    try {
      const r = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          strategy: 'rsi_macd',
          timeframe: '1h',
          params: { rsi_lower: 30, rsi_upper: 70, macd_fast: 12, macd_slow: 26, macd_signal: 9 }
        })
      });
      if (r.ok) {
        const d = await r.json();
        const formatted = d.equity_curve.map(pt => ({
          time: pt.timestamp.split(' ')[1],
          close: pt.price
        })).slice(-20);
        
        setPriceHistory(formatted);
        if (formatted.length > 0) {
          setPrice(formatted[formatted.length - 1].close.toString());
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWatchlistItemClick = async (clickedSymbol) => {
    setSymbol(clickedSymbol);
    setUpdatingSymbol(true);
    try {
      const r = await fetch('/api/active_symbol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: clickedSymbol })
      });
      if (r.ok) {
        fetchPortfolio();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingSymbol(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    const q = parseFloat(qty);
    const p = parseFloat(price);

    if (isNaN(q) || q <= 0 || isNaN(p) || p <= 0) {
      alert("Please provide valid quantity and price.");
      return;
    }

    try {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side,
          qty: q,
          price: p
        })
      });
      if (response.ok) {
        fetchPortfolio();
        fetchLogs();
        alert("Order executed successfully!");
      } else {
        const errorData = await response.json();
        alert(`Order rejected: ${errorData.detail || 'Check balance/positions'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Order submission error.");
    }
  };

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const currentMarketPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].close : 0.0;
  const isPriceUp = priceHistory.length > 1 ? priceHistory[priceHistory.length - 1].close >= priceHistory[0].close : true;

  // Map 1D Close price stream to standard OHLC candlesticks
  const generateCandleData = (history) => {
    return history.map((pt, index) => {
      const close = pt.close;
      let open;
      if (index === 0) {
        open = close * (1 + (Math.random() - 0.5) * 0.002);
      } else {
        open = history[index - 1].close;
      }
      
      const bodyDiff = Math.abs(close - open);
      const high = Math.max(open, close) + (Math.random() * 0.35 + 0.05) * (bodyDiff || close * 0.001);
      const low = Math.min(open, close) - (Math.random() * 0.35 + 0.05) * (bodyDiff || close * 0.001);

      return {
        time: pt.time,
        open,
        high,
        low,
        close,
        bodyRange: [Math.min(open, close), Math.max(open, close)]
      };
    });
  };

  const candleData = generateCandleData(priceHistory);

  const watchlist = {
    STOCKS: [
      { symbol: 'AAPL', name: 'Apple Inc.', price: 178.45, chg: -1.65, chgPct: -0.91 },
      { symbol: 'TSLA', name: 'Tesla Inc.', price: 182.20, chg: 3.45, chgPct: 1.95 },
      { symbol: 'MSFT', name: 'Microsoft Corp.', price: 421.15, chg: 5.12, chgPct: 1.23 }
    ],
    FOREX: [
      { symbol: 'EURUSD=X', name: 'EUR / USD', price: 1.0815, chg: -0.0006, chgPct: -0.06 },
      { symbol: 'GBPUSD=X', name: 'GBP / USD', price: 1.2642, chg: 0.0024, chgPct: 0.19 },
      { symbol: 'GC=F', name: 'Gold Spot', price: 2320.50, chg: -28.30, chgPct: -1.21 }
    ],
    CRYPTO: [
      { symbol: 'BTC-USD', name: 'Bitcoin / USD', price: 62905.00, chg: -407.00, chgPct: -0.64 },
      { symbol: 'ETH-USD', name: 'Ethereum / USD', price: 3418.20, chg: 15.40, chgPct: 0.45 },
      { symbol: 'APX-USD', name: 'ApexTrade Token', price: 4299.00, chg: -28.30, chgPct: -0.66 }
    ]
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#09090b', minHeight: '100%' }}>
      
      {/* TradingView Workspace Container */}
      <div className="tv-workspace">
        
        {/* Top Header Toolbar */}
        <div className="tv-top-toolbar">
          <div className="tv-toolbar-group">
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', borderRight: '1px solid #27272a', paddingRight: '12px' }}>
              {symbol}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button className="tv-toolbar-btn active">5m</button>
              <button className="tv-toolbar-btn">1h</button>
              <button className="tv-toolbar-btn">1D</button>
            </div>
            <div style={{ width: '1px', height: '16px', background: '#27272a' }}></div>
            <button className="tv-toolbar-btn">
              <BarChart2 size={13} /> Indicators
            </button>
          </div>
          
          <div className="tv-toolbar-group">
            <button className="tv-toolbar-btn">
              <Bell size={13} /> Alert
            </button>
            <button className="tv-toolbar-btn">
              <History size={13} /> Replay
            </button>
            <div style={{ width: '1px', height: '16px', background: '#27272a' }}></div>
            <button className="tv-toolbar-btn" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}>
              Trade
            </button>
            <button className="tv-toolbar-btn" style={{ background: '#27272a', color: 'white' }}>
              Publish
            </button>
          </div>
        </div>

        {/* Main Area: Sidebar Drawing Tools + Chart + Watchlist */}
        <div style={{ display: 'flex', height: '420px', position: 'relative' }}>
          
          {/* Left vertical drawing toolbar */}
          <div className="tv-left-toolbar">
            <button className={`tv-left-btn ${selectedDrawingTool === 'crosshair' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('crosshair')}>
              <Crosshair size={15} />
            </button>
            <button className={`tv-left-btn ${selectedDrawingTool === 'line' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('line')}>
              <Slash size={15} />
            </button>
            <button className={`tv-left-btn ${selectedDrawingTool === 'text' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('text')}>
              <Type size={15} />
            </button>
            <button className={`tv-left-btn ${selectedDrawingTool === 'ruler' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('ruler')}>
              <Ruler size={15} />
            </button>
            <button className={`tv-left-btn ${selectedDrawingTool === 'magnet' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('magnet')}>
              <Magnet size={15} />
            </button>
            <button className={`tv-left-btn ${selectedDrawingTool === 'lock' ? 'active' : ''}`} onClick={() => setSelectedDrawingTool('lock')}>
              <Lock size={15} />
            </button>
            <button className="tv-left-btn">
              <Trash2 size={15} />
            </button>
          </div>

          {/* Center Chart Canvas */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#131722', position: 'relative', overflow: 'hidden' }}>
            
            {/* Chart info tag inside canvas */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, pointerEvents: 'none' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                {symbol} <span style={{ color: '#71717a', fontWeight: 'normal' }}>• 5 • OANDA</span>
              </div>
              <div style={{ fontSize: '11px', color: isPriceUp ? '#10b981' : '#ef4444', marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span>O: {currentMarketPrice ? (currentMarketPrice * 1.0001).toFixed(2) : '...'}</span>
                <span>H: {currentMarketPrice ? (currentMarketPrice * 1.0005).toFixed(2) : '...'}</span>
                <span>L: {currentMarketPrice ? (currentMarketPrice * 0.9995).toFixed(2) : '...'}</span>
                <span>C: {currentMarketPrice ? currentMarketPrice.toFixed(2) : '...'}</span>
              </div>
            </div>

            {/* Recharts Composed Chart with custom Candlesticks */}
            <div style={{ flex: 1, padding: '40px 10px 10px 10px' }}>
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={candleData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid stroke="#2a2e39" strokeDasharray="3 3" vertical={true} horizontal={true} />
                    <XAxis dataKey="time" stroke="#70737d" fontSize={9} tickLine={false} />
                    <YAxis stroke="#70737d" fontSize={9} domain={['dataMin - 5', 'dataMax + 5']} tickLine={false} orientation="right" />
                    <Tooltip
                      contentStyle={{ background: '#1c2030', border: '1px solid #1c1c1f', borderRadius: '8px', color: 'white', fontSize: '11px' }}
                      cursor={{ stroke: '#70737d', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Bar dataKey="bodyRange" shape={<Candlestick />} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Loading market data ticker...
                </div>
              )}
            </div>
          </div>

          {/* Right Watchlist Panel */}
          <div className="tv-watchlist">
            <div className="tv-watchlist-title-bar">
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>Watchlist</span>
              <div style={{ display: 'flex', gap: '8px', color: '#71717a' }}>
                <Plus size={14} className="cursor-pointer hover:text-white" />
                <Edit size={14} className="cursor-pointer hover:text-white" />
                <MoreHorizontal size={14} className="cursor-pointer hover:text-white" />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {Object.keys(watchlist).map((catName) => (
                <div key={catName}>
                  <div className="tv-watchlist-category">{catName}</div>
                  {watchlist[catName].map((item) => (
                    <div 
                      key={item.symbol} 
                      className={`tv-watchlist-item ${symbol === item.symbol ? 'active' : ''}`}
                      onClick={() => handleWatchlistItemClick(item.symbol)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 'bold', color: symbol === item.symbol ? '#ffffff' : '#e2e8f0' }}>{item.symbol.split('-')[0]}</span>
                        <span style={{ fontSize: '9px', color: '#52525b' }}>{item.name}</span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500' }}>
                          {item.symbol.includes('=X') ? item.price.toFixed(4) : item.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          color: item.chgPct >= 0 ? '#10b981' : '#ef4444',
                          width: '52px',
                          display: 'inline-block'
                        }}>
                          {item.chgPct >= 0 ? '+' : ''}{item.chgPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Workspace Split Panel */}
        <div className="tv-bottom-tabs-bar">
          <button 
            className={`tv-tab-btn ${activeWorkspaceTab === 'trade' ? 'active' : ''}`}
            onClick={() => setActiveWorkspaceTab('trade')}
          >
            Trading Panel
          </button>
          <button 
            className={`tv-tab-btn ${activeWorkspaceTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveWorkspaceTab('logs')}
          >
            Pine Console
          </button>
          <button 
            className={`tv-tab-btn ${activeWorkspaceTab === 'orderbook' ? 'active' : ''}`}
            onClick={() => setActiveWorkspaceTab('orderbook')}
          >
            Order Book
          </button>
        </div>

        {/* Workspace Tab Content */}
        <div style={{ background: '#1c2030', borderTop: '1px solid #1c1c1f', padding: '16px', minHeight: '160px' }}>
          
          {/* Tab 1: Trading Executor Panel */}
          {activeWorkspaceTab === 'trade' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>MANUAL ORDER TICKET</span>
                <span style={{ fontSize: '12.5px', color: isPriceUp ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                  Last price: ${currentMarketPrice ? currentMarketPrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '...'}
                </span>
              </div>
              <form onSubmit={handlePlaceOrder} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr', gap: '16px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold' }}>Side</label>
                  <div style={{ display: 'flex', border: '1px solid #27272a', borderRadius: '6px', overflow: 'hidden' }}>
                    <button 
                      type="button"
                      style={{ flex: 1, padding: '6px', border: 'none', background: side === 'BUY' ? 'rgba(16,185,129,0.15)' : 'transparent', color: side === 'BUY' ? '#10b981' : '#71717a', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                      onClick={() => setSide('BUY')}
                    >
                      BUY
                    </button>
                    <button 
                      type="button"
                      style={{ flex: 1, padding: '6px', border: 'none', background: side === 'SELL' ? 'rgba(239,68,68,0.15)' : 'transparent', color: side === 'SELL' ? '#ef4444' : '#71717a', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                      onClick={() => setSide('SELL')}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold' }}>Quantity</label>
                  <input 
                    type="text" 
                    value={qty} 
                    onChange={(e) => setQty(e.target.value)}
                    style={{ background: '#09090b', border: '1px solid #27272a', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', textAlign: 'center' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold' }}>Limit Price ($)</label>
                  <input 
                    type="text" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ background: '#09090b', border: '1px solid #27272a', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 'bold', textAlign: 'center' }}
                  />
                </div>

                <button 
                  type="submit" 
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    justifyContent: 'center', 
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    border: 'none',
                    background: side === 'BUY' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                    color: 'white',
                    boxShadow: side === 'BUY' ? '0 0 10px rgba(16,185,129,0.2)' : '0 0 10px rgba(239,68,68,0.2)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Submit {side} Order
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Activity Console Logs */}
          {activeWorkspaceTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>RUNTIME CONSOLE OUTPUT</span>
                <span style={{ fontSize: '11px', color: '#71717a' }}>Streaming activity logs...</span>
              </div>
              <div className="terminal-console" style={{ height: '110px', background: '#09090b', border: '1px solid #27272a' }}>
                {logs.map((log, index) => (
                  <div key={index} className="terminal-line" style={{ fontSize: '12px' }}>
                    {log}
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </div>
          )}

          {/* Tab 3: Order Book */}
          {activeWorkspaceTab === 'orderbook' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>ORDER BOOK LIQUIDITY DEPTH</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '16px' }}>
                
                {/* Bids */}
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', fontSize: '10px', color: '#71717a', borderBottom: '1px solid #27272a', paddingBottom: '3px', fontWeight: 'bold' }}>
                    <span>BID PRICE</span>
                    <span style={{ textAlign: 'right' }}>SIZE</span>
                  </div>
                  {orderBook.bids.slice(0, 3).map((bid, i) => (
                    <div key={`bid-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', color: '#10b981', fontFamily: 'monospace', fontSize: '11.5px', padding: '2px 0' }}>
                      <span>${bid.price.toFixed(2)}</span>
                      <span style={{ color: '#a1a1aa', textAlign: 'right' }}>{bid.size.toFixed(3)}</span>
                    </div>
                  ))}
                </div>

                {/* Spread info block */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#09090b', borderRadius: '8px', border: '1px dashed #27272a', padding: '12px' }}>
                  <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase' }}>Spread</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                    ${(currentMarketPrice * 0.0003).toFixed(2)}
                  </span>
                  <span style={{ fontSize: '9px', color: '#71717a', marginTop: '2px' }}>0.03% market difference</span>
                </div>

                {/* Asks */}
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', fontSize: '10px', color: '#71717a', borderBottom: '1px solid #27272a', paddingBottom: '3px', fontWeight: 'bold' }}>
                    <span>ASK PRICE</span>
                    <span style={{ textAlign: 'right' }}>SIZE</span>
                  </div>
                  {orderBook.asks.slice(0, 3).map((ask, i) => (
                    <div key={`ask-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', color: '#ef4444', fontFamily: 'monospace', fontSize: '11.5px', padding: '2px 0' }}>
                      <span>${ask.price.toFixed(2)}</span>
                      <span style={{ color: '#a1a1aa', textAlign: 'right' }}>{ask.size.toFixed(3)}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
