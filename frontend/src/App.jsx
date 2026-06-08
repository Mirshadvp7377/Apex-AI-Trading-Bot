import React, { useState, useEffect } from 'react';
import { BarChart3, Settings, Play, Cpu, Terminal, ShieldAlert, Sparkles, LogOut, Search, Home, Layers, Plus, Sliders, ChevronDown } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StrategyHub from './components/StrategyHub';
import Backtester from './components/Backtester';
import MLManager from './components/MLManager';
import TradeTerminal from './components/TradeTerminal';
import { Demo } from './components/ui/demo';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portfolio, setPortfolio] = useState({
    balance: 10000.0,
    net_asset_value: 10000.0,
    positions_value: 0.0,
    total_pnl: 0.0,
    total_pnl_pct: 0.0,
    positions: {},
    trades: [],
    win_rate: 0.0,
    total_trades: 0,
    active_symbol: 'BTC-USD',
    algo_trading_enabled: true
  });
  const [strategies, setStrategies] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    fetchPortfolio();
    fetchStrategies();
    // Poll updates every 5 seconds to keep dashboard state real-time
    const interval = setInterval(() => {
      fetchPortfolio();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (response.ok) {
        const data = await response.json();
        setPortfolio(data);
        setConnectionStatus('online');
      } else {
        setConnectionStatus('offline');
      }
    } catch (e) {
      console.error(e);
      setConnectionStatus('offline');
    }
  };

  const fetchStrategies = async () => {
    try {
      const response = await fetch('/api/strategies');
      if (response.ok) {
        const data = await response.json();
        setStrategies(data);
      }
    } catch (e) {
      console.error("Failed to load strategies", e);
    }
  };

  const handleToggleAlgoTrading = async () => {
    const nextState = !portfolio.algo_trading_enabled;
    try {
      const response = await fetch('/api/algo_trading/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      if (response.ok) {
        fetchPortfolio();
      }
    } catch (e) {
      console.error("Failed to toggle algo trading", e);
    }
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard portfolio={portfolio} fetchPortfolio={fetchPortfolio} />;
      case 'strategies':
        return <StrategyHub strategies={strategies} portfolio={portfolio} fetchPortfolio={fetchPortfolio} fetchStrategies={fetchStrategies} />;
      case 'backtester':
        return <Backtester strategies={strategies} />;
      case 'ml':
        return <MLManager />;
      case 'terminal':
        return <TradeTerminal portfolio={portfolio} fetchPortfolio={fetchPortfolio} />;
      case 'ecosystem':
        return <Demo />;
      default:
        return <Dashboard portfolio={portfolio} fetchPortfolio={fetchPortfolio} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Navigation */}
      <div 
        style={{ 
          width: '260px', 
          borderRight: '1px solid #1c1c1f',
          padding: '24px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: '#09090b',
          height: '100vh',
          position: 'sticky',
          top: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Logo Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '8px' }}>
            <img 
              src="/logo.png" 
              alt="ApexTrade AI Logo" 
              style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} 
            />
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.3px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                ApexTrade AI
              </h1>
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Dashboard */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <BarChart3 size={16} />
              Dashboard
            </button>

            {/* Strategy Hub */}
            <button
              onClick={() => { setActiveTab('strategies'); fetchStrategies(); }}
              className={`sidebar-nav-btn ${activeTab === 'strategies' ? 'active' : ''}`}
            >
              <Settings size={16} />
              Strategy Hub
            </button>

            {/* Backtester */}
            <button
              onClick={() => { setActiveTab('backtester'); fetchStrategies(); }}
              className={`sidebar-nav-btn ${activeTab === 'backtester' ? 'active' : ''}`}
            >
              <Play size={16} />
              Backtester
            </button>

            {/* ML Prediction */}
            <button
              onClick={() => setActiveTab('ml')}
              className={`sidebar-nav-btn ${activeTab === 'ml' ? 'active' : ''}`}
            >
              <Cpu size={16} />
              ML Prediction
            </button>

            {/* Trade Terminal */}
            <button
              onClick={() => setActiveTab('terminal')}
              className={`sidebar-nav-btn ${activeTab === 'terminal' ? 'active' : ''}`}
            >
              <Terminal size={16} />
              Trade Terminal
            </button>

            {/* AI Ecosystem */}
            <button
              onClick={() => setActiveTab('ecosystem')}
              className={`sidebar-nav-btn ${activeTab === 'ecosystem' ? 'active' : ''}`}
            >
              <Sparkles size={16} />
              AI Ecosystem
            </button>
          </div>
        </div>

        {/* Bottom Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 8px' }}>
          <button
            onClick={handleToggleAlgoTrading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 16px',
              border: '1px solid #27272a',
              borderRadius: '8px',
              background: 'transparent',
              color: 'white',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'none'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#18181b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Plus size={14} />
            {portfolio.algo_trading_enabled ? 'Pause Autopilot' : 'Deploy Autopilot'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 0 0', borderTop: '1px solid #1c1c1f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', color: 'white' }}>AT</div>
              <span style={{ fontSize: '12px', color: '#71717a', fontWeight: '500' }}>ApexTrade AI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                background: connectionStatus === 'online' ? '#10b981' : connectionStatus === 'offline' ? '#ef4444' : '#f59e0b',
                boxShadow: connectionStatus === 'online' ? '0 0 6px #10b981' : 'none',
                display: 'inline-block'
              }}></span>
              <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'capitalize' }}>{connectionStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel View Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '100vh', background: '#09090b' }}>
        {/* Header Ribbon */}
        <header 
          style={{ 
            height: '56px', 
            borderBottom: '1px solid #1c1c1f', 
            padding: '0 24px', 
            display: 'flex', 
            alignItems: 'center',
            flexShrink: 0,
            background: '#09090b',
            position: 'sticky',
            top: 0,
            zIndex: 50
          }}
        >
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>ApexTrade AI</span>
              <span style={{ color: '#27272a' }}>/</span>
              <span style={{ color: 'white', textTransform: 'capitalize' }}>
                {activeTab === 'ecosystem' ? 'Components' : activeTab}
              </span>
            </div>

            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: '14px', fontWeight: '700', color: 'white', letterSpacing: '-0.2px' }}>
              {activeTab === 'ecosystem' ? 'Components' : activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'strategies' ? 'Strategy Hub' : activeTab === 'backtester' ? 'Backtester' : activeTab === 'ml' ? 'ML Manager' : 'Trade Terminal'}
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold' }}>Capital</span>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'white' }}>
                  ${portfolio.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ width: '1px', height: '16px', background: '#27272a' }}></div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold' }}>NAV</span>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#10b981', textShadow: '0 0 8px rgba(16,185,129,0.3)' }}>
                  ${portfolio.net_asset_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab View */}
        <main style={{ flex: 1 }}>
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
