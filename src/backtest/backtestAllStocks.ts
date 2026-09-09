import path from "path";

import { stocks } from "../../config/stocks";

import { loadCsv } from "../data/csvLoader";

import {
  calculateIndicators,
} from "../indicators/indicators";

import {
  backtest,
} from "./backtester";

interface StockResult {
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

  maxDrawdownPercent: number;

  maxConsecutiveLosses: number;
}

async function main() {

  const results: StockResult[] = [];

  console.log(
    "\n======================================"
  );

  console.log(
    "13 STOCK VERSION 3 BACKTEST"
  );

  console.log(
    "======================================\n"
  );

  for (
    const stock of stocks
  ) {

    try {

      console.log(
        `Testing ${stock.name}...`
      );

      const filePath =
        path.join(
          process.cwd(),
          "data",
          "daily",
          `${stock.fileName}.csv`
        );

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
          enriched,
          10000
        );

      results.push({

        stock:
          stock.name,

        trades:
          result.totalTrades,

        wins:
          result.winningTrades,

        losses:
          result.losingTrades,

        winRate:
          result.winRate,

        profit:
          result.totalProfit,

        charges:
          result.totalCharges,

        profitFactor:
          result.profitFactor,

        expectancy:
          result.expectancy,

        maxDrawdown:
          result.maxDrawdown,

        maxDrawdownPercent:
          result.maxDrawdownPercent,

        maxConsecutiveLosses:
          result.maxConsecutiveLosses,
      });

      console.log(
        `  Trades: ${result.totalTrades}`
      );

      console.log(
        `  Win Rate: ${result.winRate.toFixed(2)}%`
      );

      console.log(
        `  Profit: ₹${result.totalProfit.toFixed(2)}`
      );

      console.log(
        `  Charges: ₹${result.totalCharges.toFixed(2)}`
      );

      console.log(
        `  Profit Factor: ${
          result.profitFactor === Infinity
            ? "∞"
            : result.profitFactor.toFixed(2)
        }`
      );

      console.log(
        `  Expectancy: ₹${result.expectancy.toFixed(2)}`
      );

      console.log(
        `  Max Drawdown: ₹${result.maxDrawdown.toFixed(2)}`
      );

      console.log(
        `  Max Consecutive Losses: ${result.maxConsecutiveLosses}`
      );

      console.log("");

    } catch (error) {

      console.error(
        `❌ ${stock.name} failed`
      );

      if (
        error instanceof Error
      ) {

        console.error(
          error.message
        );

      } else {

        console.error(error);
      }
    }
  }

  /*
   * ======================================
   * SORT
   * ======================================
   *
   * We primarily sort by profit factor,
   * then expectancy.
   */

  results.sort(
    (a, b) => {

      if (
        b.profitFactor !==
        a.profitFactor
      ) {

        return (
          b.profitFactor -
          a.profitFactor
        );
      }

      return (
        b.expectancy -
        a.expectancy
      );
    }
  );

  /*
   * ======================================
   * FINAL TABLE
   * ======================================
   */

  console.log(
    "\n======================================"
  );

  console.log(
    "STOCK RANKING"
  );

  console.log(
    "======================================\n"
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

        WinRate:
          `${result.winRate.toFixed(2)}%`,

        Profit:
          `₹${result.profit.toFixed(2)}`,

        Charges:
          `₹${result.charges.toFixed(2)}`,

        ProfitFactor:
          result.profitFactor === Infinity
            ? "∞"
            : result.profitFactor.toFixed(2),

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
   * ======================================
   * PORTFOLIO TOTALS
   * ======================================
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

  const totalProfit =
    results.reduce(
      (sum, result) =>
        sum + result.profit,
      0
    );

  const totalCharges =
    results.reduce(
      (sum, result) =>
        sum + result.charges,
      0
    );

  const overallWinRate =
    totalTrades > 0
      ? (
          totalWins /
          totalTrades
        ) *
        100
      : 0;

  console.log(
    "\n======================================"
  );

  console.log(
    "PORTFOLIO SUMMARY"
  );

  console.log(
    "======================================"
  );

  console.log(
    "Total Trades:",
    totalTrades
  );

  console.log(
    "Total Wins:",
    totalWins
  );

  console.log(
    "Total Losses:",
    totalLosses
  );

  console.log(
    "Overall Win Rate:",
    `${overallWinRate.toFixed(2)}%`
  );

  console.log(
    "Total Charges:",
    `₹${totalCharges.toFixed(2)}`
  );

  console.log(
    "Net Profit:",
    `₹${totalProfit.toFixed(2)}`
  );
}

main();