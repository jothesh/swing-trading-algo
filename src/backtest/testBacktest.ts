import path from "path";

import {
  loadCsv,
} from "../data/csvLoader";

import {
  calculateIndicators,
} from "../indicators/indicators";

import {
  backtest,
} from "./backtester";

async function main() {

  try {

    const filePath =
      path.join(
        process.cwd(),
        "data",
        "daily",
        "CANBK.csv"
      );

    console.log(
      "Loading CANBK..."
    );

    const candles =
      await loadCsv(filePath);

    console.log(
      `Loaded ${candles.length} candles`
    );

    const enrichedCandles =
      calculateIndicators(
        candles
      );

    console.log(
      `Enriched candles: ${enrichedCandles.length}`
    );

    console.log(
      "\nRunning ATR backtest..."
    );

    const result =
      backtest(
        enrichedCandles,
        10000
      );

    console.log(
      "\n============================"
    );

    console.log(
      "CANBK BACKTEST RESULT"
    );

    console.log(
      "============================"
    );

    console.log(
      "Total Trades:",
      result.totalTrades
    );

    console.log(
      "Winning Trades:",
      result.winningTrades
    );

    console.log(
      "Losing Trades:",
      result.losingTrades
    );

    console.log(
      "Win Rate:",
      `${result.winRate.toFixed(2)}%`
    );

    console.log(
      "Total Profit:",
      `₹${result.totalProfit.toFixed(2)}`
    );

    console.log(
      "Total Profit %:",
      `${result.totalProfitPercent.toFixed(2)}%`
    );

    console.log(
      "Average Profit:",
      `₹${result.averageProfit.toFixed(2)}`
    );

    console.log(
      "Average Loss:",
      `₹${result.averageLoss.toFixed(2)}`
    );

    console.log(
      "Profit Factor:",
      result.profitFactor === Infinity
        ? "∞"
        : result.profitFactor.toFixed(2)
    );

    console.log(
      "\n============================"
    );

    console.log(
      "TRADES"
    );

    console.log(
      "============================"
    );

    for (
      const [index, trade]
      of result.trades.entries()
    ) {

      console.log(
        `\nTrade ${index + 1}`
      );

      console.log(
        "Entry:",
        trade.entryDate,
        `₹${trade.entryPrice.toFixed(2)}`
      );

      console.log(
        "Stop Loss:",
        `₹${trade.stopLoss.toFixed(2)}`
      );

      console.log(
        "Target:",
        `₹${trade.target.toFixed(2)}`
      );

      console.log(
        "Exit:",
        trade.exitDate ?? "-",
        trade.exitPrice !== undefined
          ? `₹${trade.exitPrice.toFixed(2)}`
          : "-"
      );

      console.log(
        "Quantity:",
        trade.quantity
      );

      console.log(
        "Profit:",
        trade.profit !== undefined
          ? `₹${trade.profit.toFixed(2)}`
          : "-"
      );

      console.log(
        "Return:",
        trade.profitPercent !== undefined
          ? `${trade.profitPercent.toFixed(2)}%`
          : "-"
      );

      console.log(
        "Result:",
        trade.result ?? "-"
      );

      console.log(
        "Exit Reason:",
        trade.exitReason ?? "-"
      );
    }

  } catch (error) {

    console.error(
      "❌ Backtest failed"
    );

    if (
      error instanceof Error
    ) {

      console.error(
        error.stack
      );

    } else {

      console.error(error);
    }
  }
}

main();