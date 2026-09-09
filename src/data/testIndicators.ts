import path from "path";

import { loadCsv } from "./csvLoader";
import { calculateIndicators } from "../indicators/indicators";

async function main() {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "daily",
      "CANBK.csv"
    );

    console.log("Loading CANBK...");

    const candles = await loadCsv(filePath);

    console.log(`Loaded ${candles.length} candles`);

    const enrichedCandles =
      calculateIndicators(candles);

    console.log(
      `Enriched candles: ${enrichedCandles.length}`
    );

    /*
     * Find the latest candle where ALL
     * required indicators are available.
     */

    const latest = [...enrichedCandles]
      .reverse()
      .find(
        candle =>
          candle.ema20 !== undefined &&
          candle.ema50 !== undefined &&
          candle.ema200 !== undefined &&
          candle.rsi !== undefined &&
          candle.macd !== undefined &&
          candle.macdSignal !== undefined &&
          candle.macdHistogram !== undefined &&
          candle.atr !== undefined &&
          candle.volumeSma !== undefined
      );

    if (!latest) {
      console.log(
        "❌ No candle has all indicators available."
      );

      return;
    }

    console.log("\n============================");
    console.log("LATEST CANBK DATA");
    console.log("============================");

    console.log("Date:", latest.date);
    console.log("Open:", latest.open);
    console.log("High:", latest.high);
    console.log("Low:", latest.low);
    console.log("Close:", latest.close);
    console.log("Volume:", latest.volume);

    console.log("\nIndicators:");

    console.log("EMA 20:", latest.ema20);
    console.log("EMA 50:", latest.ema50);
    console.log("EMA 200:", latest.ema200);

    console.log("RSI:", latest.rsi);

    console.log("MACD:", latest.macd);
    console.log(
      "MACD Signal:",
      latest.macdSignal
    );
    console.log(
      "MACD Histogram:",
      latest.macdHistogram
    );

    console.log("ATR:", latest.atr);
    console.log(
      "Volume SMA:",
      latest.volumeSma
    );

  } catch (error) {
    console.error("❌ Failed");

    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
  }
}

main();