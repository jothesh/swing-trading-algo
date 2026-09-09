import path from "path";

import { loadCsv } from "./data/csvLoader";
import {
  calculateIndicators,
} from "./indicators/indicators";

async function main() {

  const filePath = path.join(
    process.cwd(),
    "data",
    "daily",
    "CANBK.csv"
  );

  console.log("Loading CANBK...");

  const candles = await loadCsv(filePath);

  console.log(
    `Loaded ${candles.length} candles`
  );

  /*
   * Calculate indicators and enrich
   * every candle.
   */

  const enrichedCandles =
    calculateIndicators(candles);

  console.log(
    `Enriched candles: ${enrichedCandles.length}`
  );

  /*
   * Get the latest candle.
   */

  const latest =
    enrichedCandles[
      enrichedCandles.length - 1
    ];

  if (!latest) {
    throw new Error(
      "No candle data available"
    );
  }

  console.log("");
  console.log(
    "============================"
  );
  console.log(
    "LATEST CANBK DATA"
  );
  console.log(
    "============================"
  );

  console.log(
    "Date:",
    latest.date
  );

  console.log(
    "Open:",
    latest.open
  );

  console.log(
    "High:",
    latest.high
  );

  console.log(
    "Low:",
    latest.low
  );

  console.log(
    "Close:",
    latest.close
  );

  console.log(
    "Volume:",
    latest.volume
  );

  console.log("");
  console.log("Indicators:");

  console.log(
    "EMA 20:",
    latest.ema20
  );

  console.log(
    "EMA 50:",
    latest.ema50
  );

  console.log(
    "EMA 200:",
    latest.ema200
  );

  console.log(
    "RSI:",
    latest.rsi
  );

  console.log(
    "MACD:",
    latest.macd
  );

  console.log(
    "MACD Signal:",
    latest.macdSignal
  );

  console.log(
    "MACD Histogram:",
    latest.macdHistogram
  );

  console.log(
    "ATR:",
    latest.atr
  );

  console.log(
    "Volume SMA:",
    latest.volumeSma
  );
}

main().catch(
  (error) => {
    console.error(
      "❌ Error:",
      error
    );

    process.exit(1);
  }
);