import path from "path";

import { loadCsv } from "../data/csvLoader";
import {
  calculateIndicators,
} from "../indicators/indicators";

import {
  generateSignal,
} from "./swingStrategy";

async function main() {

  try {

    const filePath = path.join(
      process.cwd(),
      "data",
      "daily",
      "CANBK.csv"
    );

    const candles =
      await loadCsv(filePath);

    const enriched =
      calculateIndicators(candles);

    const latest =
      [...enriched]
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
        "No valid candle found"
      );

      return;
    }

    const result =
      generateSignal(latest);

    console.log(
      "\n============================"
    );

    console.log(
      "CANBK SWING SIGNAL"
    );

    console.log(
      "============================"
    );

    console.log(
      "Date:",
      latest.date
    );

    console.log(
      "Close:",
      latest.close
    );

    console.log(
      "Signal:",
      result.signal
    );

    console.log(
      "Score:",
      result.score
    );

    console.log(
      "\nReasons:"
    );

    for (
      const reason
      of result.reasons
    ) {

      console.log(
        `- ${reason}`
      );
    }

  } catch (error) {

    console.error(
      "❌ Strategy failed"
    );

    if (
      error instanceof Error
    ) {

      console.error(
        error.stack
      );
    }
  }
}

main();