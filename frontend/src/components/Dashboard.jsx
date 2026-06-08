import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent, ArrowUpRight, ArrowDownRight, Briefcase } from 'lucide-react';

export default function Dashboard({ portfolio, fetchPortfolio }) {
  const {
    balance,
    net_asset_value,
    positions_value,
    total_pnl,
    total_pnl_pct,
    positions,
    trades,
    win_rate,
    total_trades,
    monitored_symbols = []
  } = portfolio;

  const [newSymbol, setNewSymbol] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [regimeData, setRegimeData] = React.useState({ regime: 'RANGING_LOW_VOLATILITY', volatility: 0.0, trend_strength: 0.0, is_high_vol: false });
  
  React.useEffect(() => {
    const fetchRegime = async () => {
      try {
        const response = await fetch(`/api/regime?symbol=${portfolio.active_symbol || 'BTC-USD'}`);
        if (response.ok) {
          const data = await response.json();
          setRegimeData(data);
        }
      } catch (error) {
        console.error("Failed to fetch regime", error);
      }
    };
    
    fetchRegime();
    const interval = setInterval(fetchRegime, 5000);
    return () => clearInterval(interval);
  }, [portfolio.active_symbol]);

  const handleAddSymbol = async (e) => {
    e.preventDefault();
    if (!newSymbol) return;
    setAdding(true);
    try {
      const response = await fetch('/api/symbols/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase().trim() })
      });
      if (response.ok) {
        setNewSymbol('');
        fetchPortfolio();
      } else {
        const err = response.status === 400 ? await response.json() : { detail: "Failed to add ticker" };
        alert(err.detail || "Failed to add ticker.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveSymbol = async (symbolToRemove) => {
    try {
      const response = await fetch('/api/symbols/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbolToRemove })
      });
      if (response.ok) {
        fetchPortfolio();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Handle position exit
  const handleClosePosition = async (symbol, qty, price) => {
    try {
      const response = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          side: 'SELL',
          qty,
          price
        })
      });
      if (response.ok) {
        fetchPortfolio();
      }
    } catch (error) {
      console.error("Failed to close position", error);
    }
  };

  // Compile trade history into an equity curve data source
  const getEquityData = () => {
    if (!trades || trades.length === 0) {
      return [{ name: 'Start', value: 10000 }];
    }

    let currentVal = 10000;
    const data = [{ name: 'Start', value: currentVal }];
    
    trades.forEach((trade, index) => {
      if (trade.pnl !== null) {
        currentVal += trade.pnl;
        data.push({
          name: `Trade ${index + 1}`,
          value: Math.round(currentVal * 100) / 100
        });
      }
    });

    return data;
  };

  const chartData = getEquityData();
  const positionKeys = Object.keys(positions);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metrics Row */}
      <div className="dashboard-grid">
        {/* Net Asset Value */}
        <div className="glass-panel card-stat" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Net Asset Value</span>
            <DollarSign size={20} className="text-glow-cyan" />
          </div>
          <div className="card-value">${net_asset_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
            {total_pnl >= 0 ? (
              <>
                <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
                <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>
                  +${total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+{total_pnl_pct.toFixed(2)}%)
                </span>
              </>
            ) : (
              <>
                <TrendingDown size={16} style={{ color: 'var(--color-danger)' }} />
                <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>
                  -${Math.abs(total_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({total_pnl_pct.toFixed(2)}%)
                </span>
              </>
            )}
            <span style={{ color: '#64748b', marginLeft: '4px' }}>all time</span>
          </div>
        </div>

        {/* Free Balance */}
        <div className="glass-panel card-stat" style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Available Cash</span>
            <DollarSign size={20} style={{ color: '#a855f7' }} />
          </div>
          <div className="card-value">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <span className="card-subtext">Unallocated capital for trading</span>
        </div>

        {/* Win Rate */}
        <div className="glass-panel card-stat" style={{ borderLeft: '4px solid var(--color-success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Win Rate</span>
            <Percent size={20} className="text-glow-green" />
          </div>
          <div className="card-value text-glow-green">{win_rate.toFixed(1)}%</div>
          <span className="card-subtext">Based on {total_trades} total trades</span>
        </div>

        {/* Open Positions Value */}
        <div className="glass-panel card-stat" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title">Active Exposure</span>
            <Activity size={20} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="card-value" style={{ color: 'var(--color-warning)' }}>
            ${positions_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="card-subtext">{positionKeys.length} assets currently held</span>
        </div>
      </div>

      {/* Live Market Regime & AI Safeguards Banner */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--color-primary)', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={24} className="text-glow-cyan" />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Regime Detector ({portfolio.active_symbol || 'BTC-USD'})</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ 
                fontSize: '18px', 
                fontWeight: '800', 
                color: regimeData.regime.includes('BULLISH') ? 'var(--color-success)' : regimeData.regime.includes('BEARISH') ? 'var(--color-danger)' : regimeData.is_high_vol ? 'var(--color-warning)' : '#a855f7'
              }}>
                {regimeData.regime.replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Vol: {(regimeData.volatility * 100).toFixed(1)}% | Trend: {regimeData.trend_strength.toFixed(4)})
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Autopilot Switching</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: portfolio.regime_switching_enabled ? 'var(--color-success)' : '#64748b', marginTop: '2px' }}>
              {portfolio.regime_switching_enabled ? 'ENABLED (DYNAMIC)' : 'DISABLED'}
            </div>
          </div>
          
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }}></div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Dynamic sizing</div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: portfolio.dynamic_position_sizing_enabled ? 'var(--color-success)' : '#64748b', marginTop: '2px' }}>
              {portfolio.dynamic_position_sizing_enabled ? `ACTIVE (${portfolio.risk_pct_per_trade || 1.0}% risk)` : 'INACTIVE'}
            </div>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }}></div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Drawdown Shield</div>
            {portfolio.drawdown_shield_triggered ? (
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', background: 'var(--color-danger)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                TRIGGERED (HALT)
              </span>
            ) : (
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--color-success)', marginTop: '2px' }}>
                ACTIVE (&lt; 10% DD)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: Chart & Positions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
        {/* Chart Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} className="text-glow-cyan" /> Portfolio Equity Curve
          </h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} domain={['dataMin - 100', 'dataMax + 100']} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: 'var(--color-primary)' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Open Positions & Monitored Assets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Open Positions Panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={20} style={{ color: 'var(--color-warning)' }} /> Open Positions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '300px' }}>
              {positionKeys.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
                  No active exposure. Open trades manually or activate automation in the Strategy Hub.
                </div>
              ) : (
                positionKeys.map((symbol) => {
                  const pos = positions[symbol];
                  const floatingPnL = (pos.current_price - pos.entry_price) * pos.qty;
                  const floatingPnLPct = ((pos.current_price - pos.entry_price) / pos.entry_price) * 100.0;
                  
                  return (
                    <div key={symbol} className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '16px', color: 'white' }}>{symbol}</span>
                        <span style={{ fontSize: '13px', padding: '2px 8px', borderRadius: '4px', background: floatingPnL >= 0 ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.1)', color: floatingPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {floatingPnL >= 0 ? '+' : ''}{floatingPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({floatingPnL >= 0 ? '+' : ''}{floatingPnLPct.toFixed(2)}%)
                        </span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                        <div>Size: <span style={{ color: 'white', fontWeight: '500' }}>{pos.qty.toFixed(4)}</span></div>
                        <div>Entry: <span style={{ color: 'white', fontWeight: '500' }}>${pos.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        <div>Current: <span style={{ color: 'white', fontWeight: '500' }}>${pos.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                        <div>Exposure: <span style={{ color: 'white', fontWeight: '500' }}>${(pos.qty * pos.current_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      </div>

                      <button 
                        className="btn-danger" 
                        style={{ width: '100%', padding: '6px', fontSize: '12px', justifyContent: 'center' }}
                        onClick={() => handleClosePosition(symbol, pos.qty, pos.current_price)}
                      >
                        Close Position (Market Exit)
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Monitored Assets Panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} className="text-glow-cyan" /> Monitored Assets (Algo Loop)
            </h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', lineHeight: '1.4' }}>
              Tickers active in the background automated trading loop. Supports Stocks (AAPL), Forex (EURUSD=X), and Crypto (BTC-USD).
            </p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '4px 0' }}>
              {monitored_symbols.map((sym) => (
                <div 
                  key={sym} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    background: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'white'
                  }}
                >
                  <span>{sym}</span>
                  <button 
                    onClick={() => handleRemoveSymbol(sym)}
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'var(--color-danger)', 
                      cursor: 'pointer', 
                      fontSize: '13px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 2px'
                    }}
                    title="Remove asset"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSymbol} style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '4px' }}>
              <input 
                type="text" 
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                placeholder="e.g. MSFT, EURUSD=X"
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-glass)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13.5px'
                }}
              />
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                disabled={adding}
              >
                Add Asset
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recent Activity Log Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Recent Trade Ledger</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                <th style={{ padding: '12px' }}>Time</th>
                <th style={{ padding: '12px' }}>Symbol</th>
                <th style={{ padding: '12px' }}>Side</th>
                <th style={{ padding: '12px' }}>Quantity</th>
                <th style={{ padding: '12px' }}>Execution Price</th>
                <th style={{ padding: '12px' }}>Strategy</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>PnL ($ / %)</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No trades logged in this session yet.
                  </td>
                </tr>
              ) : (
                [...trades].reverse().map((trade) => (
                  <tr key={trade.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#e2e8f0' }}>
                    <td style={{ padding: '12px', color: '#64748b' }}>{trade.timestamp}</td>
                    <td style={{ padding: '12px', fontWeight: '600' }}>{trade.symbol}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ color: trade.side === 'BUY' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 'bold' }}>
                        {trade.side}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{trade.qty.toFixed(4)}</td>
                    <td style={{ padding: '12px' }}>${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', fontSize: '12px' }}>
                        {trade.strategy}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                      {trade.pnl !== null ? (
                        <span style={{ color: trade.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%)
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>--</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
