import fs from "fs";
import path from "path";

interface YahooResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: Array<number | null>;
          high: Array<number | null>;
          low: Array<number | null>;
          close: Array<number | null>;
          volume: Array<number | null>;
        }>;
      };
    }> | null;
  };
}

export async function downloadYahooDaily(
  symbol: string,
  outputName: string
) {
  console.log(`\nDownloading ${symbol}...`);

  const end = Math.floor(Date.now() / 1000);

  // ~3 years
  const start = end - 3 * 365 * 24 * 60 * 60;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?period1=${start}` +
    `&period2=${end}` +
    `&interval=1d` +
    `&events=history` +
    `&includeAdjustedClose=true`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Yahoo request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as YahooResponse;

  const result = data.chart.result?.[0];

  if (!result) {
    throw new Error(`No data returned for ${symbol}`);
  }

  const quote = result.indicators.quote[0];

  const rows: string[] = [
    "date,open,high,low,close,volume"
  ];

  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i];

    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      volume == null
    ) {
      continue;
    }

    const date = new Date(
      result.timestamp[i] * 1000
    )
      .toISOString()
      .split("T")[0];

    rows.push(
      `${date},${open},${high},${low},${close},${volume}`
    );
  }

  const outputDir = path.join(
    process.cwd(),
    "data",
    "daily"
  );

  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(
    outputDir,
    `${outputName}.csv`
  );

  fs.writeFileSync(
    outputPath,
    rows.join("\n"),
    "utf8"
  );

  console.log(
    `✅ ${outputName}: ${rows.length - 1} candles`
  );

  console.log(`Saved: ${outputPath}`);
}