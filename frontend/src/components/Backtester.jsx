import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Play, Activity, TrendingUp, Award, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Backtester({ strategies }) {
  const [symbol, setSymbol] = useState('BTC-USD');
  const [strategy, setStrategy] = useState('rsi_macd');
  const [timeframe, setTimeframe] = useState('1d');
  const [params, setParams] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Sync default parameters when strategy changes
  useEffect(() => {
    if (strategies[strategy]) {
      setParams(strategies[strategy].params);
      setTimeframe(strategies[strategy].timeframe);
    }
  }, [strategy, strategies]);

  const handleParamChange = (key, val) => {
    setParams(prev => ({
      ...prev,
      [key]: parseFloat(val) || val
    }));
  };

  const handleRunBacktest = async () => {
    setLoading(true);
    setResults(null);
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          strategy,
          timeframe,
          params
        })
      });
      if (response.ok) {
        const data = await response.json();
        setResults(data);
        
        // Trigger confetti if strategy return is positive AND outperforms buy & hold
        const stratRet = data.metrics.total_return_pct;
        const bhRet = data.metrics.buy_hold_return_pct;
        if (stratRet > 0 && stratRet > bhRet) {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#00d2ff', '#00e676', '#a855f7']
          });
        }
      } else {
        const errorData = await response.json();
        alert(`Backtest failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Network error running backtest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={24} className="text-glow-cyan" /> Historical Strategy Backtester
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Simulate how strategies perform over historical price data before risking live capital.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', alignItems: 'start' }}>
        {/* Parameters Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>Test Parameters</h3>
          
          {/* Symbol */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>Asset Symbol</label>
            <input 
              type="text" 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              placeholder="e.g. BTC-USD, AAPL"
            />
          </div>

          {/* Strategy Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>Strategy</label>
            <select 
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {Object.keys(strategies).map(id => (
                <option key={id} value={id}>{strategies[id].name}</option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#64748b' }}>Timeframe</label>
            <select 
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="5m">5m (Intraday)</option>
              <option value="15m">15m (Intraday)</option>
              <option value="1h">1h (Hourly)</option>
              <option value="1d">1d (Daily)</option>
              <option value="1wk">1wk (Weekly)</option>
            </select>
          </div>

          {/* Dynamic Params Form */}
          {Object.keys(params).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Strategy Params Override</span>
              {Object.keys(params).map((key) => {
                const val = params[key];
                if (typeof val === 'number') {
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: '#64748b' }}>{key.toUpperCase()}</span>
                        <span style={{ color: 'var(--color-primary)' }}>{val}</span>
                      </div>
                      <input 
                        type="number"
                        step={key.includes('std') || key.includes('multiplier') || key.includes('zscore') ? '0.1' : '1'}
                        value={val}
                        onChange={(e) => handleParamChange(key, e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-glass)',
                          color: 'white',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{key.toUpperCase()}</span>
                    <input 
                      type="text" 
                      value={val}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-glass)',
                        color: 'white',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        width: '100px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <button 
            className="btn-primary" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '12px' }}
            disabled={loading}
            onClick={handleRunBacktest}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Simulating...
              </>
            ) : (
              <>
                <Play size={16} /> Run Backtest
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {results ? (
            <>
              {/* Backtest Statistics Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {/* Total Return */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Strategy Return</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: results.metrics.total_return_pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {results.metrics.total_return_pct >= 0 ? '+' : ''}{results.metrics.total_return_pct.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Ending Balance: ${results.metrics.final_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>

                {/* Buy & Hold Return */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Buy & Hold Return</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: results.metrics.buy_hold_return_pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {results.metrics.buy_hold_return_pct >= 0 ? '+' : ''}{results.metrics.buy_hold_return_pct.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Passive holding comparison</span>
                </div>

                {/* Sharpe Ratio */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Sharpe Ratio</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-primary)' }}>
                    {results.metrics.sharpe_ratio.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Risk-adjusted rating</span>
                </div>

                {/* Drawdown */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Max Drawdown</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-danger)' }}>
                    {results.metrics.max_drawdown.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Peak-to-trough risk</span>
                </div>

                {/* Win Rate */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Win Rate / Trades</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--color-success)' }}>
                    {results.metrics.win_rate.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{results.metrics.completed_trades} closed of {results.metrics.total_trades} trades</span>
                </div>

                {/* Sortino Ratio */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Sortino Ratio</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#a855f7' }}>
                    {results.metrics.sortino_ratio !== undefined ? results.metrics.sortino_ratio.toFixed(2) : '0.00'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Downside risk adjusted</span>
                </div>

                {/* Profit Factor */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>Profit Factor</span>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: results.metrics.profit_factor >= 1.0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {results.metrics.profit_factor !== undefined ? results.metrics.profit_factor.toFixed(2) : '0.00'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Gross Profits / Gross Losses</span>
                </div>
              </div>
              
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '-8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <HelpCircle size={12} />
                <span>Simulations incorporate a default transaction fee of 0.10% (10 bps) and slippage of 0.05% (5 bps).</span>
              </div>

              {/* Backtest Line Chart */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white' }}>Historical Performance Chart</h3>
                <div style={{ width: '100%', height: '350px' }}>
                  <ResponsiveContainer>
                    <LineChart data={results.equity_curve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="timestamp" stroke="#475569" fontSize={10} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} domain={['dataMin - 100', 'dataMax + 100']} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="strategy_val" name="Strategy Portfolio" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="asset_val" name={`Buy & Hold (${symbol})`} stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Simulated Trades Ledger */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Simulation Trade Records</h3>
                <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                        <th style={{ padding: '8px' }}>Timestamp</th>
                        <th style={{ padding: '8px' }}>Action</th>
                        <th style={{ padding: '8px' }}>Price</th>
                        <th style={{ padding: '8px' }}>Size</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.trades.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                            No trades executed by strategy in this period.
                          </td>
                        </tr>
                      ) : (
                        [...results.trades].reverse().map((trade, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '8px', color: '#64748b' }}>{trade.timestamp}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ color: trade.type === 'BUY' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: '700' }}>
                                {trade.type}
                              </span>
                            </td>
                            <td style={{ padding: '8px' }}>${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '8px' }}>{trade.qty.toFixed(4)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>
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
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', textAlign: 'center', gap: '12px' }}>
              <Activity size={48} className="text-glow-cyan" style={{ opacity: 0.5 }} />
              <div>
                <h3 style={{ color: 'white', fontWeight: '600', fontSize: '18px' }}>Ready for Simulation</h3>
                <p style={{ fontSize: '14px', maxWidth: '350px', marginTop: '6px' }}>Configure your parameters and click "Run Backtest" to compute historical performance curve.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
