# ApexTrade AI Platform

An ultra-premium, production-grade quantitative trading platform and algorithmic bot utilizing multi-source data feeds, walk-forward validated ensemble machine learning models, market regime classification, and dynamic risk management metrics.

---

## 🚀 Core Features

### 📊 Multi-Source Ingestion & Feature Engineering
- Leverages standard price stream feeds (OHLCV, volume) along with synthetic proxies for funding rates, sentiment score distributions, and open interest delta proxies.
- Engineering parameters include Normalized ATR, Bollinger Bands positioning, EMA crossovers, Stochastic Oscillators, RSI Divergences, and multi-period lags.

### 🧠 Advanced Ensemble AI Model
- Combines a tree-based **Gradient Boosting Classifier**, a multi-layer **Deep Learning Neural Network (MLP)**, and a reinforcement learning **Q-learning Policy Agent** for consensus voting.
- Implements strict probability thresholds (default 60%) to filter out low-confidence signals and prevent false executions.

### ⚙️ Real-time Market Regime Switcher
- Identifies active market dynamics (Bullish Trending, Bearish Trending, High Volatility Ranging, Low Volatility Ranging) using annualized volatility metrics and trend strength indicators.
- Automatically toggles active strategy execution engines to fit the current regime on the fly.

### 🛡️ Quantitative Risk Manager & Safeguards
- **Dynamic Position Sizing**: Automatically sizes buy/sell order sizes using account risk capital rules based on available capital, entry price, and stop-loss distance.
- **Drawdown Shield**: Emergency check freezes autopilot executions and closes all active exposures if NAV falls by $\ge 10\%$ from peak valuation.
- **Safeguards**: Automatic stop-loss (SL), take-profit (TP), and trailing stop-losses.

### 📈 Walk-forward Testing & Metrics
- Simulates backtests incorporating realistic transaction commission fees (0.10%) and execution slippage (0.05%).
- Computes advanced statistical metrics including Sharpe Ratio, Sortino Ratio, Win Rate, Profit Factor, and Maximum Drawdown.

---

## 📂 Project Directory Structure

```
Apex-AI-Trading-Bot/
├── backend/
│   ├── advanced_quant_engine.py  # Regime, Ensemble, Risk modules
│   ├── data_manager.py           # Historical bar ingest & fallbacks
│   ├── indicators.py             # Technical indicators calculations
│   ├── main.py                   # FastAPI REST API endpoints
│   ├── ml_model.py               # Classical ML models
│   ├── strategies.py             # Standard strategies (RSI, BB, pairs, etc.)
│   └── test_backend.py           # Verification scripts
├── frontend/
│   ├── public/                   # Static favicon and logo assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx     # Overview, regime, NAV dashboard
│   │   │   ├── TradeTerminal.jsx # TradingView candlestick terminal
│   │   │   ├── Backtester.jsx    # Backtest simulation controls
│   │   │   └── MLManager.jsx     # Walk-forward AI telemetry charts
│   │   └── App.jsx               # Page routers & autopilot toggles
│   ├── package.json
│   └── vite.config.js
├── production_spec.md            # Production server spec
├── docker-compose.yml            # Multi-container deployment config
└── README.md                     # Documentation
```

---

## 🛠️ Local Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Server Setup
Navigate to the root directory, create a virtual environment, install requirements, and start uvicorn:
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt  # FastAPI, yfinance, scikit-learn, pandas, numpy, uvicorn

# Start backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Vite Client Setup
Navigate to the `frontend/` directory, install packages, and launch Vite dev server:
```bash
# Enter frontend folder
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🐳 Production Deployment (Docker Compose)
To run the full scalable stack (FastAPI web server, React client, PostgreSQL DB, Redis broker, Celery worker task scheduler), execute:
```bash
docker-compose up -d --build
```
Refer to the detailed [production_spec.md](production_spec.md) for database schemas and asynchronous retraining configurations.
