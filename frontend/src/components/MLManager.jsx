import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, Settings, Target, ChevronRight, TrendingUp, AlertTriangle, HelpCircle } from 'lucide-react';

export default function MLManager() {
  const [symbol, setSymbol] = useState('BTC-USD');
  const [timeframe, setTimeframe] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [featureImportances, setFeatureImportances] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);

  const loadModelInfo = async (activeSymbol) => {
    const sym = activeSymbol || symbol;
    try {
      const response = await fetch(`/api/model_info?symbol=${sym}`);
      if (response.ok) {
        const data = await response.json();
        if (data.is_trained) {
          setMetrics(data.metrics);
          setLatestPrediction(data.latest_prediction);
          
          const formattedImp = Object.keys(data.feature_importances).map(name => ({
            name,
            importance: Math.round(data.feature_importances[name] * 1000) / 10
          }));
          setFeatureImportances(formattedImp);
        } else {
          setMetrics(null);
          setLatestPrediction(null);
          setFeatureImportances([]);
        }
      }
    } catch (e) {
      console.error("Failed to load model details", e);
    }
  };

  useEffect(() => {
    loadModelInfo(symbol);
  }, [symbol]);

  const handleTrainModel = async () => {
    setLoading(true);
    setMetrics(null);
    setFeatureImportances([]);
    setLatestPrediction(null);
    try {
      const response = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe })
      });
      if (response.ok) {
        const data = await response.json();
        // Load model info immediately
        await loadModelInfo(symbol);
      } else {
        const err = await response.json();
        alert(`Training failed: ${err.detail || 'Insufficient historical data points.'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Network error while training ML model.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={24} className="text-glow-cyan" /> Advanced AI Ensemble Center
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
          Train and deploy walk-forward validated ensemble quant models (XGBoost, MLP, Q-learning Policy) with Explainable AI feedback.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '24px', alignItems: 'start' }}>
        {/* Left: Model Configurations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Configurations */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--color-primary)' }} /> Model Training Setup
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#64748b' }}>Training Asset</label>
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
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#64748b' }}>Target Timeframe</label>
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

            <button 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              disabled={loading}
              onClick={handleTrainModel}
            >
              {loading ? (
                <>
                  <span className="spinner"></span> Fitting Ensemble...
                </>
              ) : (
                <>
                  Train Ensemble Classifiers
                </>
              )}
            </button>
          </div>

          {/* Model Explanation */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'white' }}>How the Ensemble Engine Works</h4>
            <ul style={{ color: '#94a3b8', fontSize: '13px', listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <ChevronRight size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Multi-Model Voting:</strong> Integrates tree-based Gradient Boosting, Multi-Layer Perceptron (Deep Learning), and Q-learning Policy agents.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <ChevronRight size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Walk-Forward Split:</strong> Fits models on 70% in-sample data and calculates OOS validation accuracies on the remaining 30% to prevent overfitting.</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <ChevronRight size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Probability Filter:</strong> Reject trades where ensemble probability falls below strict thresholds (default 60%).</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <ChevronRight size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Dynamic retraining:</strong> Autopilot ticks continuously retrain models every 30 intervals to adapt to shifts in market regimes.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right: Results Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {metrics ? (
            <>
              {/* Classification Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
                {/* XGBoost OOS Accuracy */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>XGBoost OOS Acc</span>
                  <span className="text-glow-cyan" style={{ fontSize: '24px', fontWeight: '800' }}>
                    {(metrics.accuracy * 100).toFixed(1)}%
                  </span>
                </div>

                {/* DL MLP OOS Accuracy */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Neural Net OOS Acc</span>
                  <span className="text-glow-green" style={{ fontSize: '24px', fontWeight: '800' }}>
                    {(metrics.precision * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Ensemble Mean OOS */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Ensemble Mean OOS</span>
                  <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-warning)' }}>
                    {(metrics.f1 * 100).toFixed(1)}%
                  </span>
                </div>

                {/* Samples */}
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>In/OOS Split</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', marginTop: '4px' }}>
                    {metrics.train_size} / {metrics.test_size}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Train / validation count</span>
                </div>
              </div>

              {/* Live Telemetry Card */}
              {latestPrediction && (
                <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--color-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <Cpu size={18} className="text-glow-cyan" /> Live Signal Telemetry ({symbol})
                    </h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Evaluated just now</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Latest Ensemble Signal</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: latestPrediction.signal === 1 ? 'var(--color-success)' : latestPrediction.signal === -1 ? 'var(--color-danger)' : '#64748b' }}>
                        {latestPrediction.signal === 1 ? 'BUY SIGNAL' : latestPrediction.signal === -1 ? 'SELL SIGNAL' : 'HOLD / REJECTED'}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Signal Probability / Confidence</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: 'var(--color-primary)' }}>
                        {(latestPrediction.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.015)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Explainable AI (XAI) Factors</div>
                    <p style={{ color: '#e2e8f0', fontSize: '12.5px', lineHeight: '1.4', margin: 0 }}>
                      {latestPrediction.xai}
                    </p>
                  </div>
                </div>
              )}

              {/* Feature Importance Chart */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={20} className="text-glow-cyan" /> Multi-Source Feature Importances (XGBoost Estimator)
                </h3>
                <div style={{ width: '100%', height: '300px' }}>
                  <ResponsiveContainer>
                    <BarChart data={featureImportances} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                      <XAxis type="number" stroke="#475569" fontSize={10} tickFormatter={(val) => `${val}%`} />
                      <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} width={100} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--color-primary)' }}
                        formatter={(val) => [`${val}%`, 'Importance Weight']}
                      />
                      <Bar dataKey="importance" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', textAlign: 'center', gap: '12px' }}>
              <Target size={48} className="text-glow-cyan" style={{ opacity: 0.5 }} />
              <div>
                <h3 style={{ color: 'white', fontWeight: '600', fontSize: '18px' }}>No Model Trained Yet</h3>
                <p style={{ fontSize: '14px', maxWidth: '350px', marginTop: '6px' }}>Configure symbol and timeframe on the left, then click "Train Ensemble Classifiers" to build the walk-forward model.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
