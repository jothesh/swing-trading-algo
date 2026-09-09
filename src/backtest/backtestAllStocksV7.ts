import fs from "fs";
import path from "path";

import { loadCsv } from "../data/csvLoader";
import {
  calculateIndicators,
  EnrichedCandle,
} from "../indicators/indicators";

import {
  generateSignalV7,
  V7_RISK_PARAMS,
  V7_EXCLUDED_STOCKS,
} from "../strategy/swingStrategyV7";

interface Trade {
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

interface BacktestResult {
  stock: string;
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

const ALL_STOCKS = [
  { name: "Tata Steel", file: "TATASTEEL.csv" },
  { name: "Suzlon Energy", file: "SUZLON.csv" },
  { name: "Vodafone Idea", file: "IDEA.csv" },
  { name: "Yes Bank", file: "YESBANK.csv" },
  { name: "Ujjivan Small Finance Bank", file: "UJJIVANSFB.csv" },
  { name: "South Indian Bank", file: "SOUTHBANK.csv" },
  { name: "NHPC", file: "NHPC.csv" },
  { name: "Indian Railway Finance Corporation", file: "IRFC.csv" },
  { name: "Union Bank of India", file: "UNIONBANK.csv" },
  { name: "Bank of Baroda", file: "BANKBARODA.csv" },
  { name: "Punjab National Bank", file: "PNB.csv" },
  { name: "IDFC First Bank", file: "IDFCFIRSTB.csv" },
  { name: "Canara Bank", file: "CANBK.csv" },
];

// Live/production universe = all stocks minus the consistently weak ones.
const STOCKS = ALL_STOCKS.filter(
  s => !V7_EXCLUDED_STOCKS.includes(s.file)
);

const CAPITAL_PER_TRADE = 10000;
const CHARGE_PERCENT = 0.001;

function backtest(
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
      const signal = generateSignalV7(candle, previousCandle);

      if (signal.signal !== "BUY") continue;
      if (candle.atr === undefined || candle.atr <= 0) continue;

      // Realistic entry: next candle's open, not this candle's own close.
      entryPrice = nextCandle.open;
      entryDate = nextCandle.date;

      stopLoss = entryPrice - candle.atr * V7_RISK_PARAMS.atrStopMultiplier;
      target = entryPrice + candle.atr * V7_RISK_PARAMS.atrTargetMultiplier;

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

function calculateStats(
  stock: string,
  trades: Trade[],
  profit: number,
  charges: number
): BacktestResult {

  const wins = trades.filter(t => t.result === "WIN");
  const losses = trades.filter(t => t.result === "LOSS");

  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);

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
    stock,
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

async function main() {
  console.log("");
  console.log("======================================");
  console.log("V7 BACKTEST — TUNED STRATEGY");
  console.log(`(ADX20 + 1-candle MACD + SL${V7_RISK_PARAMS.atrStopMultiplier}xATR/TG${V7_RISK_PARAMS.atrTargetMultiplier}xATR + next-open entry)`);
  console.log(`Universe: ${STOCKS.length} stocks (excluded: ${V7_EXCLUDED_STOCKS.join(", ")})`);
  console.log("======================================");
  console.log("");

  const results: BacktestResult[] = [];

  for (const stock of STOCKS) {
    const filePath = path.join(process.cwd(), "data", "daily", stock.file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${stock.file}`);
      continue;
    }

    const candles = await loadCsv(filePath);
    const enriched = calculateIndicators(candles);
    const result = backtest(enriched);
    const stats = calculateStats(stock.name, result.trades, result.profit, result.charges);
    results.push(stats);
  }

  results.sort((a, b) => b.profit - a.profit);

  console.table(
    results.map((r, index) => ({
      Rank: index + 1,
      Stock: r.stock,
      Trades: r.trades,
      Wins: r.wins,
      Losses: r.losses,
      WinRate: `${r.winRate.toFixed(2)}%`,
      Profit: `₹${r.profit.toFixed(2)}`,
      ProfitFactor: Number.isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "∞",
      Expectancy: `₹${r.expectancy.toFixed(2)}`,
      MaxDD: `₹${r.maxDrawdown.toFixed(2)}`,
      MaxLossStreak: r.maxConsecutiveLosses,
    }))
  );

  const totalTrades = results.reduce((s, r) => s + r.trades, 0);
  const totalWins = results.reduce((s, r) => s + r.wins, 0);
  const totalCharges = results.reduce((s, r) => s + r.charges, 0);
  const totalProfit = results.reduce((s, r) => s + r.profit, 0);
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  console.log("");
  console.log("======================================");
  console.log("V7 PORTFOLIO SUMMARY");
  console.log("======================================");
  console.log(`Total Trades: ${totalTrades}`);
  console.log(`Overall Win Rate: ${overallWinRate.toFixed(2)}%`);
  console.log(`Total Charges: ₹${totalCharges.toFixed(2)}`);
  console.log(`Net Profit: ₹${totalProfit.toFixed(2)}`);
  console.log("");
}

main().catch(error => {
  console.error("❌ Backtest failed:", error);
  process.exit(1);
});
