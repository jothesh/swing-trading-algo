import {
  EnrichedCandle,
} from "../indicators/indicators";

import {
  generateSignalV9,
  V9_RISK_PARAMS,
} from "../strategy/swingStrategyV9";

export interface Trade {
  entryDate: string;
  entryPrice: number;

  exitDate: string;
  exitPrice: number;

  stopLoss: number;
  target: number;

  quantity: number;

  profit: number;
  returnPercent: number;

  result: "WIN" | "LOSS";
  exitReason: "TARGET" | "STOP_LOSS";
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
  charges: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  maxConsecutiveLosses: number;
}

const CAPITAL_PER_TRADE = 10000;
const CHARGE_PERCENT = 0.001;

/*
 * Runs the V8 strategy across a full candle
 * history and returns every completed trade.
 * Shared by:
 *  - the CLI backtest script (historical stats)
 *  - the live signal generator (per-stock rating,
 *    computed from the same historical data)
 *
 * Keeping this in one place means the live
 * rating can never silently drift out of sync
 * with what the backtest actually measured.
 */
export function runBacktest(
  candles: EnrichedCandle[]
): { trades: Trade[]; profit: number; charges: number } {

  const trades: Trade[] = [];
  let totalCharges = 0;
  let inTrade = false;

  let entryPrice = 0;
  let entryDate = "";
  let stopLoss = 0;
  let target = 0;
  let quantity = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    if (!inTrade) {
      const nextCandle = candles[i + 1];
      if (!nextCandle) continue;

      const previousCandle = i > 0 ? candles[i - 1] : undefined;
      const signal = generateSignalV9(candle, previousCandle);

      if (signal.signal !== "BUY") continue;
      if (candle.atr === undefined || candle.atr <= 0) continue;

      entryPrice = nextCandle.open;
      entryDate = nextCandle.date;

      stopLoss = entryPrice - candle.atr * V9_RISK_PARAMS.atrStopMultiplier;
      target = entryPrice + candle.atr * V9_RISK_PARAMS.atrTargetMultiplier;

      quantity = Math.floor(CAPITAL_PER_TRADE / entryPrice);
      if (quantity <= 0) continue;

      inTrade = true;
      i += 1;
      continue;
    }

    let exitPrice: number | null = null;
    let exitReason: "TARGET" | "STOP_LOSS" | null = null;

    if (candle.low <= stopLoss) {
      exitPrice = stopLoss;
      exitReason = "STOP_LOSS";
    } else if (candle.high >= target) {
      exitPrice = target;
      exitReason = "TARGET";
    }

    if (exitPrice === null || exitReason === null) continue;

    const grossProfit = (exitPrice - entryPrice) * quantity;
    const turnover = (entryPrice + exitPrice) * quantity;
    const charges = turnover * CHARGE_PERCENT;
    const netProfit = grossProfit - charges;

    totalCharges += charges;

    const returnPercent = (netProfit / (entryPrice * quantity)) * 100;

    trades.push({
      entryDate,
      entryPrice,
      exitDate: candle.date,
      exitPrice,
      stopLoss,
      target,
      quantity,
      profit: netProfit,
      returnPercent,
      result: exitReason === "TARGET" ? "WIN" : "LOSS",
      exitReason,
    });

    inTrade = false;
    entryPrice = 0;
    entryDate = "";
    stopLoss = 0;
    target = 0;
    quantity = 0;
  }

  const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);

  return { trades, profit: totalProfit, charges: totalCharges };
}

export function calculateStats(
  trades: Trade[],
  profit: number,
  charges: number
): BacktestStats {

  const wins = trades.filter(t => t.result === "WIN");
  const losses = trades.filter(t => t.result === "LOSS");

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);
  // Note: 99 is used as a display-friendly cap instead of Infinity —
  // JSON.stringify(Infinity) silently becomes null, which breaks the
  // frontend. 99 clearly signals "no losing trades yet" without that bug.

  const expectancy = trades.length > 0 ? profit / trades.length : 0;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    equity += trade.profit;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  let currentLosses = 0;
  let maxConsecutiveLosses = 0;

  for (const trade of trades) {
    if (trade.result === "LOSS") {
      currentLosses++;
      if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
    } else {
      currentLosses = 0;
    }
  }

  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    profit,
    charges,
    profitFactor,
    expectancy,
    maxDrawdown,
    maxConsecutiveLosses,
  };
}

/*
 * Simple A/B/C/D letter rating from backtest
 * stats, for display in the dashboard.
 * Combines win rate + profit factor +
 * expectancy into one score so stocks can be
 * sorted/graded at a glance.
 */
export function rateStock(stats: BacktestStats): {
  grade: "A" | "B" | "C" | "D" | "N/A";
  score: number;
} {

  if (stats.trades < 3) {
    // Too few historical trades to trust a rating.
    return { grade: "N/A", score: 0 };
  }

  const winRateScore = Math.min(stats.winRate, 100); // 0-100
  const pfScore = Math.min(stats.profitFactor * 30, 100); // cap so a single huge PF doesn't dominate
  const expectancyScore = Math.min(Math.max(stats.expectancy / 10, 0), 100); // ₹10 expectancy = 1 point, capped

  const score =
    winRateScore * 0.4 +
    pfScore * 0.4 +
    expectancyScore * 0.2;

  let grade: "A" | "B" | "C" | "D";

  if (score >= 65) grade = "A";
  else if (score >= 50) grade = "B";
  else if (score >= 35) grade = "C";
  else grade = "D";

  return { grade, score: Math.round(score) };
}
