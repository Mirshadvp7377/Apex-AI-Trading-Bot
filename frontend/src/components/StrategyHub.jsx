import React, { useState, useEffect } from 'react';
import { ShieldCheck, ToggleLeft, ToggleRight, Sliders, Save, Cpu } from 'lucide-react';

export default function StrategyHub({ strategies, portfolio, fetchPortfolio, fetchStrategies }) {
  const [editingParams, setEditingParams] = useState({});
  const [editingTimeframes, setEditingTimeframes] = useState({});

  const [stopLoss, setStopLoss] = useState(portfolio?.global_stop_loss_pct ?? 2.0);
  const [takeProfit, setTakeProfit] = useState(portfolio?.global_take_profit_pct ?? 4.0);
  const [trailingStop, setTrailingStop] = useState(portfolio?.global_trailing_stop_pct ?? 0.0);
  const [tradeAllocation, setTradeAllocation] = useState(portfolio?.trade_allocation_usd ?? 100.0);

  useEffect(() => {
    if (portfolio) {
      setStopLoss(portfolio.global_stop_loss_pct ?? 2.0);
      setTakeProfit(portfolio.global_take_profit_pct ?? 4.0);
      setTrailingStop(portfolio.global_trailing_stop_pct ?? 0.0);
      setTradeAllocation(portfolio.trade_allocation_usd ?? 100.0);
    }
  }, [portfolio]);

  const handleSaveRiskSettings = async () => {
    try {
      const response = await fetch('/api/risk/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stop_loss: stopLoss,
          take_profit: takeProfit,
          trailing_stop: trailingStop,
          trade_allocation: tradeAllocation
        })
      });
      if (response.ok) {
        alert("Global Risk Safeguards updated successfully!");
        fetchPortfolio();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save risk safeguards.");
    }
  };

  // Local state helper to edit parameters before saving
  const handleParamChange = (stratId, paramKey, val) => {
    setEditingParams(prev => ({
      ...prev,
      [stratId]: {
        ...prev[stratId],
        [paramKey]: parseFloat(val) || val
      }
    }));
  };

  const handleTimeframeChange = (stratId, tf) => {
    setEditingTimeframes(prev => ({
      ...prev,
      [stratId]: tf
    }));
  };

  // Toggle state of strategy on backend
  const handleToggle = async (stratId) => {
    try {
      const res = await fetch('/api/strategies/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stratId })
      });
      if (res.ok) {
        fetchPortfolio();
        fetchStrategies();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save changes to backend
  const handleSave = async (stratId) => {
    const updatedParams = editingParams[stratId] || {};
    const updatedTimeframe = editingTimeframes[stratId] || strategies[stratId].timeframe;

    try {
      const res = await fetch('/api/strategies/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stratId,
          timeframe: updatedTimeframe,
          params: updatedParams
        })
      });
      if (res.ok) {
        alert(`${strategies[stratId].name} configuration updated successfully!`);
        fetchPortfolio();
        fetchStrategies();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRiskBadgeColor = (risk) => {
    const r = risk.toLowerCase();
    if (r.includes('low')) return 'rgba(0, 230, 118, 0.15)';
    if (r.includes('medium-high') || r.includes('high')) return 'rgba(255, 23, 68, 0.15)';
    return 'rgba(255, 179, 0, 0.15)';
  };

  const getRiskTextColor = (risk) => {
    const r = risk.toLowerCase();
    if (r.includes('low')) return 'var(--color-success)';
    if (r.includes('medium-high') || r.includes('high')) return 'var(--color-danger)';
    return 'var(--color-warning)';
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={24} className="text-glow-cyan" /> Algorithmic Trading Hub
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
            Configure and deploy strategies to trade automatically on your active asset.
          </p>
        </div>
      </div>

      {/* Global Risk Management Card */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(255, 23, 68, 0.15)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} className="text-glow-red" /> Global Risk & Position Management
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '13.5px' }}>
          Define safeguards that apply globally to all open positions. Set any level to 0% to disable that specific filter.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginTop: '8px' }}>
          {/* Stop Loss Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>STOP LOSS (SL)</span>
              <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
                {stopLoss > 0 ? `${stopLoss.toFixed(1)}%` : 'DISABLED'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1" 
              value={stopLoss} 
              onChange={(e) => setStopLoss(parseFloat(e.target.value))} 
              style={{ accentColor: 'var(--color-danger)', width: '100%', height: '4px' }}
            />
          </div>

          {/* Take Profit Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>TAKE PROFIT (TP)</span>
              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
                {takeProfit > 0 ? `${takeProfit.toFixed(1)}%` : 'DISABLED'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="20" 
              step="0.1" 
              value={takeProfit} 
              onChange={(e) => setTakeProfit(parseFloat(e.target.value))} 
              style={{ accentColor: 'var(--color-success)', width: '100%', height: '4px' }}
            />
          </div>

          {/* Trailing Stop Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>TRAILING STOP</span>
              <span style={{ color: '#a855f7', fontWeight: 'bold' }}>
                {trailingStop > 0 ? `${trailingStop.toFixed(1)}%` : 'DISABLED'}
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1" 
              value={trailingStop} 
              onChange={(e) => setTrailingStop(parseFloat(e.target.value))} 
              style={{ accentColor: '#a855f7', width: '100%', height: '4px' }}
            />
          </div>

          {/* Position Sizing Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: '600' }}>POSITION SIZE (USD)</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                ${tradeAllocation.toLocaleString()}
              </span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="1000" 
              step="10" 
              value={tradeAllocation} 
              onChange={(e) => setTradeAllocation(parseFloat(e.target.value))} 
              style={{ accentColor: 'var(--color-primary)', width: '100%', height: '4px' }}
            />
          </div>
        </div>

        <button 
          className="btn-danger" 
          style={{ width: 'fit-content', padding: '8px 24px', fontSize: '13px', alignSelf: 'flex-end', marginTop: '8px' }}
          onClick={handleSaveRiskSettings}
        >
          Save Risk Safeguards
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {Object.keys(strategies).map((id) => {
          const strat = strategies[id];
          const isActive = strat.enabled;
          
          // Get parameters merging backend with local edits
          const currentParams = {
            ...strat.params,
            ...(editingParams[id] || {})
          };

          const currentTimeframe = editingTimeframes[id] || strat.timeframe;

          return (
            <div 
              key={id} 
              className={`glass-panel ${isActive ? 'glass-card-glow' : ''}`}
              style={{ 
                padding: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{strat.name}</h3>
                  <span 
                    style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: getRiskBadgeColor(strat.risk), 
                      color: getRiskTextColor(strat.risk),
                      fontWeight: '700',
                      display: 'inline-block',
                      marginTop: '6px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Risk: {strat.risk}
                  </span>
                </div>
                
                {/* Switch Toggle */}
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={isActive}
                    onChange={() => handleToggle(id)} 
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* Description */}
              <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: '1.5' }}>
                {strat.description}
              </p>

              <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }} />

              {/* Parameters Setup */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Timeframe selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Timeframe</span>
                  <select 
                    value={currentTimeframe}
                    onChange={(e) => handleTimeframeChange(id, e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="5m">5m (Intraday)</option>
                    <option value="15m">15m (Intraday)</option>
                    <option value="1h">1h (Hourly)</option>
                    <option value="1d">1d (Daily)</option>
                    <option value="1wk">1wk (Weekly)</option>
                  </select>
                </div>

                {/* Specific sliders / inputs based on strategy parameters */}
                {Object.keys(currentParams).map((paramKey) => {
                  const paramVal = currentParams[paramKey];
                  const label = paramKey.replace('_', ' ').toUpperCase();

                  // Render slider if numeric
                  if (typeof paramVal === 'number') {
                    // Determine ranges dynamically based on keys
                    let min = 1, max = 500, step = 1;
                    if (paramKey.includes('lower') || paramKey.includes('oversold')) { min = 5; max = 45; }
                    else if (paramKey.includes('upper') || paramKey.includes('overbought')) { min = 55; max = 95; }
                    else if (paramKey.includes('std')) { min = 0.5; max = 4.0; step = 0.1; }
                    else if (paramKey.includes('multiplier')) { min = 1.0; max = 6.0; step = 0.1; }
                    else if (paramKey.includes('zscore')) { min = 0.5; max = 4.0; step = 0.1; }
                    else if (paramKey.includes('period') || paramKey.includes('window') || paramKey.includes('fast') || paramKey.includes('slow')) {
                      min = 2; max = 300;
                    }

                    return (
                      <div key={paramKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#64748b' }}>{label}</span>
                          <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>{paramVal}</span>
                        </div>
                        <input 
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={paramVal}
                          onChange={(e) => handleParamChange(id, paramKey, e.target.value)}
                          style={{ accentColor: 'var(--color-primary)', width: '100%', height: '4px' }}
                        />
                      </div>
                    );
                  }

                  // Otherwise render a standard text input (e.g. for symbols)
                  return (
                    <div key={paramKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
                      <input 
                        type="text" 
                        value={paramVal}
                        onChange={(e) => handleParamChange(id, paramKey, e.target.value)}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-glass)',
                          color: 'white',
                          padding: '4px 8px',
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

              {/* Action Save button */}
              <button 
                className="btn-secondary" 
                style={{ width: '100%', padding: '8px', fontSize: '13px', justifyContent: 'center', marginTop: '10px' }}
                onClick={() => handleSave(id)}
              >
                <Save size={16} /> Save Configuration
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
