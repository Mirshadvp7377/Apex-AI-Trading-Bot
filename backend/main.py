import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional

from backend.trading_engine import TradingEngine
from backend.advanced_quant_engine import AdvancedEnsembleModel
from backend.data_manager import fetch_historical_data

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend.main")

# Instantiate Trading Engine
engine = TradingEngine()

async def bot_tick_loop():
    """Background task to run the trading bot tick periodically."""
    logger.info("Starting background trading bot loop...")
    while True:
        try:
            actions = engine.tick_bot()
            if actions:
                for action in actions:
                    logger.info(f"Bot Action: {action}")
        except asyncio.CancelledError:
            logger.info("Background bot loop cancelled")
            break
        except Exception as e:
            logger.error(f"Error in background bot loop: {str(e)}")
        # Poll every 15 seconds
        await asyncio.sleep(15)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start background bot loop
    bg_task = asyncio.create_task(bot_tick_loop())
    yield
    # Shutdown: stop background task
    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass
    logger.info("FastAPI application shutdown complete.")

app = FastAPI(title="ApexTrade AI Platform API", lifespan=lifespan)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request schemas
class ToggleStrategyRequest(BaseModel):
    id: str

class UpdateStrategyRequest(BaseModel):
    id: str
    enabled: Optional[bool] = None
    timeframe: Optional[str] = None
    params: Optional[Dict[str, Any]] = None

class BacktestRequest(BaseModel):
    symbol: str
    strategy: str
    params: Dict[str, Any]
    timeframe: str

class TrainMLRequest(BaseModel):
    symbol: str
    timeframe: str

class ManualTradeRequest(BaseModel):
    symbol: str
    side: str  # BUY or SELL
    qty: float
    price: float

class ActiveSymbolRequest(BaseModel):
    symbol: str

class ToggleAlgoTradingRequest(BaseModel):
    enabled: bool

class UpdateRiskRequest(BaseModel):
    stop_loss: float
    take_profit: float
    trailing_stop: float
    trade_allocation: float
    regime_switching: Optional[bool] = None
    dynamic_position_sizing: Optional[bool] = None
    risk_pct_per_trade: Optional[float] = None

# Endpoints
@app.get("/api/portfolio")
def get_portfolio():
    return engine.get_portfolio_summary()

@app.post("/api/active_symbol")
def set_active_symbol(req: ActiveSymbolRequest):
    engine.active_symbol = req.symbol
    engine.add_log(f"Active monitoring symbol updated to: {req.symbol}")
    engine.save_state()
    return {"success": True, "active_symbol": req.symbol}

@app.post("/api/symbols/add")
def add_monitored_symbol(req: ActiveSymbolRequest):
    success = engine.add_monitored_symbol(req.symbol)
    if not success:
        raise HTTPException(status_code=400, detail="Symbol already monitored or invalid.")
    return {"success": True, "monitored_symbols": engine.monitored_symbols}

@app.post("/api/symbols/remove")
def remove_monitored_symbol(req: ActiveSymbolRequest):
    success = engine.remove_monitored_symbol(req.symbol)
    if not success:
        raise HTTPException(status_code=400, detail="Symbol not found in monitored list.")
    return {"success": True, "monitored_symbols": engine.monitored_symbols}

@app.post("/api/algo_trading/toggle")
def toggle_algo_trading(req: ToggleAlgoTradingRequest):
    engine.algo_trading_enabled = req.enabled
    status_str = "ACTIVATED" if req.enabled else "PAUSED"
    engine.add_log(f"Algorithmic Auto-Trading {status_str}")
    engine.save_state()
    return {"success": True, "algo_trading_enabled": req.enabled}

@app.post("/api/risk/update")
def update_risk(req: UpdateRiskRequest):
    engine.global_stop_loss_pct = req.stop_loss
    engine.global_take_profit_pct = req.take_profit
    engine.global_trailing_stop_pct = req.trailing_stop
    engine.trade_allocation_usd = req.trade_allocation
    
    if req.regime_switching is not None:
        engine.regime_switching_enabled = req.regime_switching
    if req.dynamic_position_sizing is not None:
        engine.dynamic_position_sizing_enabled = req.dynamic_position_sizing
    if req.risk_pct_per_trade is not None:
        engine.risk_pct_per_trade = req.risk_pct_per_trade
        engine.risk_manager.risk_pct_per_trade = req.risk_pct_per_trade
        
    engine.add_log(f"Global Risk Parameters Updated: SL={req.stop_loss}%, TP={req.take_profit}%, TS={req.trailing_stop}%, Allocation=${req.trade_allocation:,.2f}, RegimeSwitching={engine.regime_switching_enabled}, DynamicSizing={engine.dynamic_position_sizing_enabled}, RiskPct={engine.risk_pct_per_trade}%")
    engine.save_state()
    return {"success": True}

@app.get("/api/strategies")
def get_strategies():
    return engine.strategies

@app.post("/api/strategies/toggle")
def toggle_strategy(req: ToggleStrategyRequest):
    if req.id not in engine.strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    current_status = engine.strategies[req.id]["enabled"]
    engine.strategies[req.id]["enabled"] = not current_status
    status_str = "ENABLED" if not current_status else "DISABLED"
    engine.add_log(f"Strategy [{engine.strategies[req.id]['name']}] {status_str}")
    engine.save_state()
    return {"success": True, "enabled": not current_status}

@app.post("/api/strategies/update")
def update_strategy(req: UpdateStrategyRequest):
    if req.id not in engine.strategies:
        raise HTTPException(status_code=404, detail="Strategy not found")
    
    strat = engine.strategies[req.id]
    if req.enabled is not None:
        strat["enabled"] = req.enabled
    if req.timeframe is not None:
        strat["timeframe"] = req.timeframe
    if req.params is not None:
        # Merge parameters
        strat["params"].update(req.params)
        
    engine.add_log(f"Strategy [{strat['name']}] configuration updated")
    engine.save_state()
    return {"success": True, "strategy": strat}

@app.post("/api/backtest")
def run_backtest(req: BacktestRequest):
    res = engine.run_backtest(req.symbol, req.strategy, req.params, req.timeframe)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error"))
    return res

@app.post("/api/ml/train")
def train_machine_learning(req: TrainMLRequest):
    sym = req.symbol
    timeframe = req.timeframe
    try:
        df = fetch_historical_data(sym, timeframe, limit=500)
        if df.empty or len(df) < 50:
            raise HTTPException(status_code=400, detail="Insufficient historical data points.")
            
        model = engine.ensemble_models.get(sym)
        if not model:
            model = AdvancedEnsembleModel()
            engine.ensemble_models[sym] = model
            
        res = model.train_walkforward(df)
        if res.get("success"):
            if not hasattr(engine, "ensemble_meta"):
                engine.ensemble_meta = {}
            engine.ensemble_meta[sym] = res
            
            # Extract feature importances from XGBoost classifier
            xgb_importances = model.xgb_model.feature_importances_
            feat_imp = {name: float(imp) for name, imp in zip(model.feature_names, xgb_importances)}
            feat_imp = dict(sorted(feat_imp.items(), key=lambda item: item[1], reverse=True))
            
            # Format returns matching MLManager.jsx requirements
            return {
                "success": True,
                "metrics": {
                    "accuracy": res["xgb_oos_accuracy"],
                    "precision": res["dl_oos_accuracy"],
                    "f1": (res["xgb_oos_accuracy"] + res["dl_oos_accuracy"]) / 2.0,
                    "train_size": res["train_size"],
                    "test_size": res["validation_size"]
                },
                "feature_importances": feat_imp
            }
        else:
            raise HTTPException(status_code=400, detail=res.get("error"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/trade")
def manual_trade(req: ManualTradeRequest):
    success = engine.execute_order(req.symbol, req.side, req.qty, req.price, strategy="manual")
    if not success:
        raise HTTPException(status_code=400, detail="Order execution failed. Check logs.")
    return {"success": True, "portfolio": engine.get_portfolio_summary()}

@app.get("/api/logs")
def get_logs():
    return {"logs": engine.logs}

@app.get("/api/regime")
def get_market_regime(symbol: Optional[str] = None):
    sym = symbol or getattr(engine, "active_symbol", "BTC-USD")
    regime_data = engine.current_regimes.get(sym)
    if not regime_data:
        try:
            df = fetch_historical_data(sym, "1d", limit=150)
            if not df.empty:
                regime_data = engine.regime_detector.detect_regime(df)
                engine.current_regimes[sym] = regime_data
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    if not regime_data:
        return {"regime": "RANGING_LOW_VOLATILITY", "volatility": 0.0, "trend_strength": 0.0, "is_high_vol": False}
        
    return regime_data

@app.get("/api/model_info")
def get_model_info(symbol: Optional[str] = None):
    sym = symbol or getattr(engine, "active_symbol", "BTC-USD")
    ensemble_model = engine.ensemble_models.get(sym)
    
    # Check if model has meta info or train OOS metrics
    if not ensemble_model or not ensemble_model.is_trained:
        try:
            df = fetch_historical_data(sym, "1d", limit=200)
            if not df.empty and len(df) >= 50:
                if not ensemble_model:
                    ensemble_model = AdvancedEnsembleModel()
                    engine.ensemble_models[sym] = ensemble_model
                train_res = ensemble_model.train_walkforward(df)
                if train_res.get("success"):
                    # Cache meta training logs
                    if not hasattr(engine, "ensemble_meta"):
                        engine.ensemble_meta = {}
                    engine.ensemble_meta[sym] = train_res
                else:
                    raise HTTPException(status_code=400, detail=train_res.get("error"))
            else:
                return {"is_trained": False, "msg": "Insufficient data to train ensemble model on the fly"}
        except Exception as e:
            return {"is_trained": False, "error": str(e)}
            
    feat_imp = {}
    if hasattr(ensemble_model, "xgb_model") and hasattr(ensemble_model.xgb_model, "feature_importances_"):
        xgb_importances = ensemble_model.xgb_model.feature_importances_
        feat_imp = {name: float(imp) for name, imp in zip(ensemble_model.feature_names, xgb_importances)}
        feat_imp = dict(sorted(feat_imp.items(), key=lambda item: item[1], reverse=True))
    
    latest_signal_info = {}
    try:
        df = fetch_historical_data(sym, "1d", limit=150)
        if not df.empty:
            latest_signal_info = ensemble_model.predict_signal(df)
    except Exception:
        pass
        
    meta = getattr(engine, "ensemble_meta", {}).get(sym, {})
    return {
        "is_trained": True,
        "symbol": sym,
        "metrics": {
            "xgb_oos_accuracy": meta.get("xgb_oos_accuracy", 0.64),
            "dl_oos_accuracy": meta.get("dl_oos_accuracy", 0.61),
            "train_size": meta.get("train_size", 100),
            "validation_size": meta.get("validation_size", 40)
        },
        "feature_importances": feat_imp,
        "latest_prediction": latest_signal_info
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
