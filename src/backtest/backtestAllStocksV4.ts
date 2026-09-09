import fs from "fs";
import path from "path";

import { loadCsv } from "../data/csvLoader";
import {
  calculateIndicators,
  EnrichedCandle,
} from "../indicators/indicators";

import {
  generateSignalV4,
} from "../strategy/swingStrategyV4";

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

const STOCKS = [
  {
    name: "Tata Steel",
    file: "TATASTEEL.csv",
  },
  {
    name: "Suzlon Energy",
    file: "SUZLON.csv",
  },
  {
    name: "Vodafone Idea",
    file: "IDEA.csv",
  },
  {
    name: "Yes Bank",
    file: "YESBANK.csv",
  },
  {
    name: "Ujjivan Small Finance Bank",
    file: "UJJIVANSFB.csv",
  },
  {
    name: "South Indian Bank",
    file: "SOUTHBANK.csv",
  },
  {
    name: "NHPC",
    file: "NHPC.csv",
  },
  {
    name: "Indian Railway Finance Corporation",
    file: "IRFC.csv",
  },
  {
    name: "Union Bank of India",
    file: "UNIONBANK.csv",
  },
  {
    name: "Bank of Baroda",
    file: "BANKBARODA.csv",
  },
  {
    name: "Punjab National Bank",
    file: "PNB.csv",
  },
  {
    name: "IDFC First Bank",
    file: "IDFCFIRSTB.csv",
  },
  {
    name: "Canara Bank",
    file: "CANBK.csv",
  },
];

/*
 * ==========================================
 * SETTINGS
 * ==========================================
 */

const CAPITAL_PER_TRADE = 10000;

const ATR_STOP_MULTIPLIER = 2;

const ATR_TARGET_MULTIPLIER = 4;

/*
 * Approximate trading charges.
 *
 * This is intentionally kept configurable.
 */

const CHARGE_PERCENT = 0.001;

/*
 * ==========================================
 * BACKTEST
 * ==========================================
 */

function backtest(
  candles: EnrichedCandle[]
): {
  trades: Trade[];
  profit: number;
  charges: number;
} {

  const trades: Trade[] = [];

  let totalCharges = 0;

  let inTrade = false;

  let entryPrice = 0;
  let entryDate = "";

  let stopLoss = 0;
  let target = 0;

  let quantity = 0;

  for (
    let i = 0;
    i < candles.length;
    i++
  ) {

    const candle = candles[i];

    if (!candle) {
      continue;
    }

    /*
     * ======================================
     * ENTRY
     * ======================================
     */

    if (!inTrade) {

      const signal =
        generateSignalV4(candle);

      if (
        signal.signal !== "BUY"
      ) {
        continue;
      }

      if (
        candle.atr === undefined ||
        candle.atr <= 0
      ) {
        continue;
      }

      entryPrice = candle.close;

      entryDate = candle.date;

      stopLoss =
        entryPrice -
        candle.atr *
          ATR_STOP_MULTIPLIER;

      target =
        entryPrice +
        candle.atr *
          ATR_TARGET_MULTIPLIER;

      quantity = Math.floor(
        CAPITAL_PER_TRADE /
          entryPrice
      );

      if (quantity <= 0) {
        continue;
      }

      inTrade = true;

      continue;
    }

    /*
     * ======================================
     * EXIT
     * ======================================
     */

    let exitPrice: number | null =
      null;

    let exitReason:
      | "TARGET"
      | "STOP_LOSS"
      | null = null;

    /*
     * Conservative assumption:
     *
     * If both SL and target are touched
     * on the same candle, assume SL hit
     * first.
     */

    if (
      candle.low <= stopLoss
    ) {

      exitPrice = stopLoss;

      exitReason = "STOP_LOSS";

    } else if (
      candle.high >= target
    ) {

      exitPrice = target;

      exitReason = "TARGET";
    }

    if (
      exitPrice === null ||
      exitReason === null
    ) {
      continue;
    }

    /*
     * ======================================
     * PROFIT
     * ======================================
     */

    const grossProfit =
      (exitPrice - entryPrice) *
      quantity;

    /*
     * Approximate round-trip charges.
     */

    const turnover =
      (entryPrice + exitPrice) *
      quantity;

    const charges =
      turnover *
      CHARGE_PERCENT;

    const netProfit =
      grossProfit -
      charges;

    totalCharges += charges;

    const returnPercent =
      (netProfit /
        (entryPrice * quantity)) *
      100;

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

      result:
        exitReason === "TARGET"
          ? "WIN"
          : "LOSS",

      exitReason,
    });

    /*
     * Reset trade.
     */

    inTrade = false;

    entryPrice = 0;
    entryDate = "";

    stopLoss = 0;
    target = 0;

    quantity = 0;
  }

  /*
   * If a trade is still open at the end,
   * we don't count it as a completed trade.
   */

  const totalProfit =
    trades.reduce(
      (sum, trade) =>
        sum + trade.profit,
      0
    );

  return {
    trades,
    profit: totalProfit,
    charges: totalCharges,
  };
}

/*
 * ==========================================
 * STATISTICS
 * ==========================================
 */

function calculateStats(
  stock: string,
  trades: Trade[],
  profit: number,
  charges: number
): BacktestResult {

  const wins =
    trades.filter(
      trade =>
        trade.result === "WIN"
    );

  const losses =
    trades.filter(
      trade =>
        trade.result === "LOSS"
    );

  const winRate =
    trades.length > 0
      ? (wins.length /
          trades.length) *
        100
      : 0;

  const grossProfit =
    wins.reduce(
      (sum, trade) =>
        sum + trade.profit,
      0
    );

  const grossLoss =
    Math.abs(
      losses.reduce(
        (sum, trade) =>
          sum + trade.profit,
        0
      )
    );

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  const expectancy =
    trades.length > 0
      ? profit / trades.length
      : 0;

  /*
   * ======================================
   * MAX DRAWDOWN
   * ======================================
   */

  let equity = 0;
  let peak = 0;

  let maxDrawdown = 0;

  for (const trade of trades) {

    equity += trade.profit;

    if (equity > peak) {
      peak = equity;
    }

    const drawdown =
      peak - equity;

    if (
      drawdown >
      maxDrawdown
    ) {
      maxDrawdown =
        drawdown;
    }
  }

  /*
   * ======================================
   * MAX CONSECUTIVE LOSSES
   * ======================================
   */

  let currentLosses = 0;

  let maxConsecutiveLosses = 0;

  for (const trade of trades) {

    if (
      trade.result === "LOSS"
    ) {

      currentLosses++;

      if (
        currentLosses >
        maxConsecutiveLosses
      ) {
        maxConsecutiveLosses =
          currentLosses;
      }

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

/*
 * ==========================================
 * MAIN
 * ==========================================
 */

async function main() {

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    "13 STOCK VERSION 4 BACKTEST"
  );

  console.log(
    "======================================"
  );

  console.log("");

  const results: BacktestResult[] = [];

  for (const stock of STOCKS) {

    console.log(
      `Testing ${stock.name}...`
    );

    const filePath =
      path.join(
        process.cwd(),
        "data",
        "daily",
        stock.file
      );

    if (
      !fs.existsSync(filePath)
    ) {

      console.log(
        `  ❌ File not found: ${stock.file}`
      );

      continue;
    }

    try {

      const candles =
        await loadCsv(
          filePath
        );

      const enriched =
        calculateIndicators(
          candles
        );

      const result =
        backtest(
          enriched
        );

      const stats =
        calculateStats(
          stock.name,
          result.trades,
          result.profit,
          result.charges
        );

      results.push(stats);

      console.log(
        `  Trades: ${stats.trades}`
      );

      console.log(
        `  Win Rate: ${stats.winRate.toFixed(2)}%`
      );

      console.log(
        `  Profit: ₹${stats.profit.toFixed(2)}`
      );

      console.log(
        `  Charges: ₹${stats.charges.toFixed(2)}`
      );

      console.log(
        `  Profit Factor: ${
          Number.isFinite(
            stats.profitFactor
          )
            ? stats.profitFactor.toFixed(2)
            : "∞"
        }`
      );

      console.log(
        `  Expectancy: ₹${stats.expectancy.toFixed(2)}`
      );

      console.log(
        `  Max Drawdown: ₹${stats.maxDrawdown.toFixed(2)}`
      );

      console.log(
        `  Max Consecutive Losses: ${stats.maxConsecutiveLosses}`
      );

      console.log("");

    } catch (error) {

      console.error(
        `  ❌ Failed: ${stock.name}`
      );

      console.error(
        error
      );
    }
  }

  /*
   * ==========================================
   * RANKING
   * ==========================================
   */

  results.sort(
    (a, b) =>
      b.profit - a.profit
  );

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    "V4 STOCK RANKING"
  );

  console.log(
    "======================================"
  );

  console.table(
    results.map(
      (result, index) => ({
        Rank:
          index + 1,

        Stock:
          result.stock,

        Trades:
          result.trades,

        Wins:
          result.wins,

        Losses:
          result.losses,

        WinRate:
          `${result.winRate.toFixed(2)}%`,

        Profit:
          `₹${result.profit.toFixed(2)}`,

        Charges:
          `₹${result.charges.toFixed(2)}`,

        ProfitFactor:
          Number.isFinite(
            result.profitFactor
          )
            ? result.profitFactor.toFixed(2)
            : "∞",

        Expectancy:
          `₹${result.expectancy.toFixed(2)}`,

        MaxDD:
          `₹${result.maxDrawdown.toFixed(2)}`,

        MaxLossStreak:
          result.maxConsecutiveLosses,
      })
    )
  );

  /*
   * ==========================================
   * PORTFOLIO SUMMARY
   * ==========================================
   */

  const totalTrades =
    results.reduce(
      (sum, result) =>
        sum + result.trades,
      0
    );

  const totalWins =
    results.reduce(
      (sum, result) =>
        sum + result.wins,
      0
    );

  const totalLosses =
    results.reduce(
      (sum, result) =>
        sum + result.losses,
      0
    );

  const totalCharges =
    results.reduce(
      (sum, result) =>
        sum + result.charges,
      0
    );

  const totalProfit =
    results.reduce(
      (sum, result) =>
        sum + result.profit,
      0
    );

  const overallWinRate =
    totalTrades > 0
      ? (totalWins /
          totalTrades) *
        100
      : 0;

  console.log("");

  console.log(
    "======================================"
  );

  console.log(
    "V4 PORTFOLIO SUMMARY"
  );

  console.log(
    "======================================"
  );

  console.log(
    `Total Trades: ${totalTrades}`
  );

  console.log(
    `Total Wins: ${totalWins}`
  );

  console.log(
    `Total Losses: ${totalLosses}`
  );

  console.log(
    `Overall Win Rate: ${overallWinRate.toFixed(2)}%`
  );

  console.log(
    `Total Charges: ₹${totalCharges.toFixed(2)}`
  );

  console.log(
    `Net Profit: ₹${totalProfit.toFixed(2)}`
  );

  console.log("");
}

main().catch(
  error => {

    console.error(
      "❌ Backtest failed:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);