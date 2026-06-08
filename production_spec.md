# Production Architecture & Deployment Specification

This document provides a production-grade specification for deploying the AI Trading Bot Platform at scale. It defines the system architecture, folder layouts, PostgreSQL database designs, task execution workflows, and Docker configurations.

---

## 1. System Architecture

A robust microservices architecture ensures isolation of model training, real-time data ingestion, and client request-handling.

```mermaid
graph TD
    subgraph Client Layer
        React[React / Vite Frontend UI]
    end

    subgraph API Layer
        FastAPI[FastAPI Web Server]
    end

    subgraph Ingestion & Worker Layer
        CeleryWorker[Celery Worker: Model Retraining]
        CeleryTick[Celery Beat: Bot Tick Ingest]
        Redis[(Redis Message Broker)]
    end

    subgraph Storage Layer
        Postgres[(PostgreSQL Database)]
    end

    subgraph External Sources
        YahooFin[yfinance / Fallbacks API]
    end

    React <-->|REST / WS| FastAPI
    FastAPI <-->|SQL| Postgres
    FastAPI <-->|Trigger Tasks| Redis
    CeleryWorker <-->|Pull Tasks| Redis
    CeleryWorker <-->|Update Models| Postgres
    CeleryTick -->|Schedule Ingestion| Redis
    CeleryWorker <-->|Fetch OHLCV| YahooFin
    CeleryTick <-->|Fetch Live Bars| YahooFin
```

---

## 2. Production Folder Structure

```
ai-trading-bot/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD pipeline
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI entrypoint
│   │   ├── config.py             # Environment configurations
│   │   ├── database.py           # SQL Alchemy session engine
│   │   ├── models/               # SQLAlchemy ORM Tables
│   │   │   ├── __init__.py
│   │   │   ├── market.py         # OHLCV & Regime schemas
│   │   │   ├── portfolio.py      # Trades & Positions schemas
│   │   │   └── model_info.py     # Walk-Forward metrics schemas
│   │   ├── crud/                 # Database CRUD functions
│   │   ├── workers/              # Celery task definitions
│   │   │   ├── tasks.py          # Retrain & Bot ticks tasks
│   │   │   └── celery_app.py     # Worker configurations
│   │   └── quant/                # Trading & AI Math engine
│   │       ├── __init__.py
│   │       ├── indicators.py
│   │       ├── quant_engine.py   # Regime, Ensemble, Risk modules
│   │       └── trading_loop.py   # Autopilot executor
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic/                  # SQL Database migrations
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TradeTerminal.jsx
│   │   │   ├── Backtester.jsx
│   │   │   └── MLManager.jsx
│   │   ├── App.jsx
│   │   └── index.css
│   ├── package.json
│   ├── Dockerfile
│   └── vite.config.js
├── docker-compose.yml            # Production environment stack
└── production_spec.md            # System specifications
```

---

## 3. Database Schema Design (PostgreSQL)

To handle time-series bars, trades, and model analytics, we configure a PostgreSQL database. Below is the SQL DDL definition:

```sql
-- 1. Ticker Definition Table
CREATE TABLE symbols (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    asset_name VARCHAR(100),
    asset_class VARCHAR(50) NOT NULL, -- 'CRYPTO', 'STOCK', 'FOREX'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Time-Series OHLCV Table (Time-scaled partitions recommended in production)
CREATE TABLE ohlcv_data (
    id BIGSERIAL PRIMARY KEY,
    symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL, -- '5m', '15m', '1h', '1d'
    timestamp TIMESTAMP NOT NULL,
    open_price NUMERIC(20, 8) NOT NULL,
    high_price NUMERIC(20, 8) NOT NULL,
    low_price NUMERIC(20, 8) NOT NULL,
    close_price NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 4) NOT NULL,
    UNIQUE(symbol_id, timeframe, timestamp)
);
CREATE INDEX idx_ohlcv_lookup ON ohlcv_data(symbol_id, timeframe, timestamp DESC);

-- 3. Live Positions Table
CREATE TABLE active_positions (
    symbol VARCHAR(20) PRIMARY KEY,
    quantity NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
    entry_price NUMERIC(20, 8) NOT NULL,
    stop_loss_price NUMERIC(20, 8),
    take_profit_price NUMERIC(20, 8),
    trailing_stop_price NUMERIC(20, 8),
    highest_price NUMERIC(20, 8),
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Trade Execution Ledger Table
CREATE TABLE trades_ledger (
    id VARCHAR(50) PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity NUMERIC(20, 8) NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    fee NUMERIC(20, 8) DEFAULT 0.00,
    strategy VARCHAR(50) DEFAULT 'manual',
    pnl NUMERIC(20, 8),
    pnl_pct NUMERIC(10, 4),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Market Regime Logging Table
CREATE TABLE regime_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    regime VARCHAR(50) NOT NULL, -- 'TRENDING_BULLISH', 'TRENDING_BEARISH', etc.
    volatility NUMERIC(10, 6) NOT NULL,
    trend_strength NUMERIC(10, 6) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Model Walk-Forward Performance Table
CREATE TABLE model_performance_logs (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    xgb_oos_accuracy NUMERIC(5, 4) NOT NULL,
    dl_oos_accuracy NUMERIC(5, 4) NOT NULL,
    ensemble_mean_oos NUMERIC(5, 4) NOT NULL,
    train_size INTEGER NOT NULL,
    validation_size INTEGER NOT NULL,
    trained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Continuous Retraining Workflows

To prevent model degradation, retraining is executed asynchronously by Celery Workers.

```python
# backend/app/workers/tasks.py
import logging
from celery import Celery
from celery.schedules import crontab
from backend.app.quant.quant_engine import AdvancedEnsembleModel
from backend.app.database import SessionLocal
from backend.app.crud.market import get_historical_bars

celery_app = Celery("trading_tasks", broker="redis://redis:6379/0", backend="redis://redis:6379/0")
logger = logging.getLogger(__name__)

@celery_app.task
def retrain_ensemble_model_task(symbol: str, timeframe: str):
    """Asynchronous worker task to retrain the Ensemble model walk-forward."""
    logger.info(f"Retraining worker triggered for {symbol} ({timeframe})")
    
    db = SessionLocal()
    try:
        # Fetch OHLCV data from database
        df = get_historical_bars(db, symbol, timeframe, limit=500)
        if len(df) < 100:
            logger.warning("Aborted: Insufficient bars for walk-forward training")
            return False
            
        model = AdvancedEnsembleModel()
        result = model.train_walkforward(df)
        
        if result.get("success"):
            # Save results, accuracies, and weights to model_performance_logs database
            logger.info(f"Retrained successfully! OOS Accuracy: {result['xgb_oos_accuracy']:.2%}")
            # Cache the serialized model states in Redis/Postgres
            return True
        else:
            logger.error(f"Retraining failed: {result.get('error')}")
            return False
    finally:
        db.close()

# Scheduler Crontab Configurations
celery_app.conf.beat_schedule = {
    # Retrain BTC model daily at midnight
    "retrain-btc-daily": {
        "task": "backend.app.workers.tasks.retrain_ensemble_model_task",
        "schedule": crontab(hour=0, minute=0),
        "args": ("BTC-USD", "1d")
    },
    # Trigger Autopilot Bot tick evaluation every minute
    "bot-tick-every-minute": {
        "task": "backend.app.workers.tasks.run_autopilot_tick_task",
        "schedule": 60.0
    }
}
```

---

## 5. Deployment Configurations

We orchestrate the entire deployment via Docker Compose.

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: quant_postgres
    environment:
      POSTGRES_USER: quant_user
      POSTGRES_PASSWORD: quant_secure_password
      POSTGRES_DB: quant_trading_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    container_name: quant_redis
    ports:
      - "6379:6379"
    restart: always

  backend:
    build: ./backend
    container_name: quant_backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql://quant_user:quant_secure_password@postgres/quant_trading_db
      - REDIS_URL=redis://redis:6379/0
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    restart: always

  celery_worker:
    build: ./backend
    container_name: quant_celery_worker
    command: celery -A app.workers.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://quant_user:quant_secure_password@postgres/quant_trading_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      - postgres
    restart: always

  celery_beat:
    build: ./backend
    container_name: quant_celery_beat
    command: celery -A app.workers.celery_app beat --loglevel=info
    environment:
      - DATABASE_URL=postgresql://quant_user:quant_secure_password@postgres/quant_trading_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    restart: always

  frontend:
    build: ./frontend
    container_name: quant_frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
```
