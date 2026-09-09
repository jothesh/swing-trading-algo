import fs from "fs";
import csv from "csv-parser";

import { Candle } from "../indicators/indicators";

export function loadCsv(
  filePath: string
): Promise<Candle[]> {

  return new Promise((resolve, reject) => {

    const candles: Candle[] = [];

    if (!fs.existsSync(filePath)) {
      reject(
        new Error(`CSV file not found: ${filePath}`)
      );

      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: any) => {

        const candle: Candle = {
          date: row.date,
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          volume: Number(row.volume),
        };

        // Validate the data before adding it
        if (
          !candle.date ||
          !Number.isFinite(candle.open) ||
          !Number.isFinite(candle.high) ||
          !Number.isFinite(candle.low) ||
          !Number.isFinite(candle.close) ||
          !Number.isFinite(candle.volume)
        ) {
          console.warn(
            "Skipping invalid row:",
            row
          );

          return;
        }

        candles.push(candle);

      })
      .on("end", () => {

        candles.sort(
          (a, b) =>
            new Date(a.date).getTime() -
            new Date(b.date).getTime()
        );

        resolve(candles);

      })
      .on("error", (error) => {
        reject(error);
      });

  });
}