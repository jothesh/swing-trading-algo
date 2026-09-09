import fs from "fs";
import path from "path";

import { loadCsv } from "../data/csvLoader";
import {
  calculateIndicators,
  EnrichedCandle,
} from "../indicators/indicators";

import {
  generateSignalV9,
  V9_RISK_PARAMS,
  Metric,
} from "../strategy/swingStrategyV9";

import { calculateTradePotential, TradePotential } from "../strategy/tradePotential";

import {
  runBacktest,
  calculateStats,
  rateStock,
} from "../backtest/engine";

import {
  calculateSupportResistance,
  SupportResistance,
} from "../indicators/supportResistance";

import { LIVE_STOCKS } from "../config/stocks";

export interface LiveSignal {
  stock: string;
  file: string;

  asOfDate: string;
  lastClose: number;

  signal: "BUY" | "SELL" | "HOLD";
  reasons: string[];
  metrics: Metric[];
  passCount: number;
  totalChecks: number;

  // Only populated when signal === "BUY"
  suggestedEntry: number | null; // next trading day's open — unknown until then, so this is an ESTIMATE using last close as a proxy
  stopLoss: number | null;
  target: number | null;
  riskPerShare: number | null;
  rewardPerShare: number | null;

  // Calculated regardless of signal, using last close
  // as a hypothetical entry — review potential yourself
  potential: TradePotential;

  // Historical rating, computed from this
  // stock's own backtest history
  rating: {
    grade: "A" | "B" | "C" | "D" | "N/A";
    score: number;
    historicalTrades: number;
    historicalWinRate: number;
    historicalProfitFactor: number;
  };

  supportResistance: SupportResistance;
}



/*
 * Evaluate ONE stock's latest data and return
 * its current signal + historical rating.
 *
 * IMPORTANT: the signal is generated from the
 * LATEST CLOSED candle. Per how V8 was
 * backtested, the realistic, tradeable entry
 * is the NEXT trading day's open — which
 * doesn't exist yet on the day you're
 * generating this signal. `suggestedEntry`
 * below is therefore an ESTIMATE using the
 * latest close as a stand-in, not a guarantee
 * of your actual fill price tomorrow.
 */
export async function evaluateStock(
  stockName: string,
  filePath: string
): Promise<LiveSignal | null> {

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const candles = await loadCsv(filePath);

  if (candles.length < 210) {
    // Not enough history for EMA200/ADX to be
    // reliable — indicators need ~200 candles
    // warm-up (see indicators.ts).
    console.warn(
      `⚠️  ${stockName}: only ${candles.length} candles available, ` +
      `need 210+ for reliable indicators. Skipping.`
    );
    return null;
  }

  const enriched = calculateIndicators(candles);

  const lastCandle = enriched[enriched.length - 1];
  const previousCandle = enriched[enriched.length - 2];

  if (!lastCandle) {
    return null;
  }

  const result = generateSignalV9(lastCandle, previousCandle);
  const passCount = result.metrics.filter(m => m.status === "pass").length;

  // Historical rating, computed fresh from
  // this stock's own data every run — so it
  // stays current as new data is added.
  const backtestResult = runBacktest(enriched);
  const stats = calculateStats(
    backtestResult.trades,
    backtestResult.profit,
    backtestResult.charges
  );
  const rating = rateStock(stats);

  const supportResistance = calculateSupportResistance(
    enriched,
    enriched.length - 1
  );

  let suggestedEntry: number | null = null;
  let stopLoss: number | null = null;
  let target: number | null = null;
  let riskPerShare: number | null = null;
  let rewardPerShare: number | null = null;

  if (result.signal === "BUY" && lastCandle.atr) {
    // Estimate using last close — actual fill
    // will be tomorrow's open, which can gap
    // up or down from this estimate.
    suggestedEntry = lastCandle.close;
    riskPerShare = lastCandle.atr * V9_RISK_PARAMS.atrStopMultiplier;
    rewardPerShare = lastCandle.atr * V9_RISK_PARAMS.atrTargetMultiplier;
    stopLoss = suggestedEntry - riskPerShare;
    target = suggestedEntry + rewardPerShare;
  }

  // Calculated regardless of signal, using the last
  // close as a hypothetical entry — so you can review
  // potential yourself even on a HOLD/SELL day.
  const potential = calculateTradePotential(
    lastCandle.close,
    lastCandle.atr ?? 0,
    V9_RISK_PARAMS.atrStopMultiplier,
    V9_RISK_PARAMS.atrTargetMultiplier
  );

  return {
    stock: stockName,
    file: path.basename(filePath),
    asOfDate: lastCandle.date,
    lastClose: lastCandle.close,
    signal: result.signal,
    reasons: result.reasons,
    metrics: result.metrics,
    passCount,
    totalChecks: result.metrics.length,
    suggestedEntry,
    stopLoss,
    target,
    riskPerShare,
    rewardPerShare,
    potential,
    rating: {
      grade: rating.grade,
      score: rating.score,
      historicalTrades: stats.trades,
      historicalWinRate: stats.winRate,
      historicalProfitFactor: stats.profitFactor,
    },
    supportResistance,
  };
}

/*
 * Returns full enriched historical candle data
 * for one stock, with support/resistance computed
 * at each point — used by the dashboard's
 * historical data view.
 */
export async function getStockHistory(
  stockName: string,
  filePath: string
): Promise<{
  stock: string;
  candles: (EnrichedCandle & { supportResistance: SupportResistance })[];
} | null> {

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const candles = await loadCsv(filePath);
  const enriched = calculateIndicators(candles);

  const withLevels = enriched.map((candle, index) => ({
    ...candle,
    supportResistance: calculateSupportResistance(enriched, index),
  }));

  return {
    stock: stockName,
    candles: withLevels,
  };
}

export function getLiveStockList() {
  return LIVE_STOCKS;
}

/*
 * Evaluate the full live/production stock
 * universe. This is what the dashboard API
 * will call.
 */
export async function getAllLiveSignals(
  dataDir: string
): Promise<LiveSignal[]> {

  const results: LiveSignal[] = [];

  for (const stock of LIVE_STOCKS) {
    const filePath = path.join(dataDir, stock.file);
    const signal = await evaluateStock(stock.name, filePath);
    if (signal) {
      results.push(signal);
    }
  }

  // BUY signals first, then by rating score descending
  results.sort((a, b) => {
    if (a.signal === "BUY" && b.signal !== "BUY") return -1;
    if (a.signal !== "BUY" && b.signal === "BUY") return 1;
    return b.rating.score - a.rating.score;
  });

  return results;
}

/*
 * CLI entry point — run directly to print
 * today's signals to the console.
 */
async function main() {

  const dataDir = path.join(process.cwd(), "data", "daily");

  console.log("");
  console.log("======================================");
  console.log("LIVE SIGNALS — V9 STRATEGY");
  console.log("======================================");
  console.log("");
  console.log(
    "NOTE: suggestedEntry/stopLoss/target below are"
  );
  console.log(
    "ESTIMATES based on the latest close. Actual entry"
  );
  console.log(
    "happens at the NEXT trading day's open, which can"
  );
  console.log(
    "gap from this estimate. Recompute stop/target using"
  );
  console.log(
    "the real fill price once the position is open."
  );
  console.log("");

  const signals = await getAllLiveSignals(dataDir);

  console.table(
    signals.map(s => ({
      Stock: s.stock,
      AsOf: s.asOfDate,
      LastClose: s.lastClose.toFixed(2),
      Signal: s.signal,
      Rating: s.rating.grade,
      Score: s.rating.score,
      HistWinRate: `${s.rating.historicalWinRate.toFixed(1)}%`,
      HistTrades: s.rating.historicalTrades,
      Entry: s.suggestedEntry?.toFixed(2) ?? "-",
      StopLoss: s.stopLoss?.toFixed(2) ?? "-",
      Target: s.target?.toFixed(2) ?? "-",
    }))
  );

  const buys = signals.filter(s => s.signal === "BUY");

  console.log("");
  console.log(
    `${buys.length} BUY signal(s) found out of ${signals.length} stocks evaluated.`
  );

  if (buys.length > 0) {
    console.log("");
    console.log("--- BUY signal details ---");
    for (const s of buys) {
      console.log("");
      console.log(`${s.stock} (${s.rating.grade}-rated, score ${s.rating.score})`);
      console.log(`  As of: ${s.asOfDate} | Last close: ₹${s.lastClose.toFixed(2)}`);
      console.log(`  Estimated entry: ₹${s.suggestedEntry?.toFixed(2)}`);
      console.log(`  Stop loss: ₹${s.stopLoss?.toFixed(2)} (risk: ₹${s.riskPerShare?.toFixed(2)}/share)`);
      console.log(`  Target: ₹${s.target?.toFixed(2)} (reward: ₹${s.rewardPerShare?.toFixed(2)}/share)`);
      console.log(`  Historical: ${s.rating.historicalWinRate.toFixed(1)}% win rate over ${s.rating.historicalTrades} trades, PF ${s.rating.historicalProfitFactor.toFixed(2)}`);
      console.log(`  Reasons: ${s.reasons.join("; ")}`);
    }
  }

  console.log("");
}

if (require.main === module) {
  main().catch(error => {
    console.error("❌ Live signal generation failed:", error);
    process.exit(1);
  });
}
