import fs from "fs";
import path from "path";
import { fetchDailyHistory } from "../data/yahooProvider";

/*
 * ==========================================
 * ADD STOCK — ONE COMMAND
 * ==========================================
 *
 * Usage:
 *   npx tsx src/scripts/addStock.ts "Company Name" SYMBOL.NS
 *
 * Examples:
 *   npx tsx src/scripts/addStock.ts "Reliance Industries" RELIANCE.NS
 *   npx tsx src/scripts/addStock.ts "Chandrima Mercantiles" CHANDRIMA.BO
 *
 * This does everything in one step:
 *   1. Fetches ~3 years of historical daily data
 *      from Yahoo Finance and saves it as a CSV
 *   2. Adds the stock to src/config/stocks.ts
 *      automatically (no manual file editing)
 *
 * After running this, the new stock will show up
 * in the dashboard, backtest, and live signals —
 * no other changes needed.
 * ==========================================
 */

async function main() {
  const [name, symbol] = process.argv.slice(2);

  if (!name || !symbol) {
    console.error("Usage: npx tsx src/scripts/addStock.ts \"Company Name\" SYMBOL.NS");
    console.error("Example: npx tsx src/scripts/addStock.ts \"Reliance Industries\" RELIANCE.NS");
    console.error("(Use .NS for NSE-listed stocks, .BO for BSE-only stocks)");
    process.exit(1);
  }

  // Derive a filename from the symbol, e.g. "RELIANCE.NS" -> "RELIANCE.csv"
  const filename = `${symbol.split(".")[0]}.csv`;

  console.log(`Adding "${name}" (${symbol})...`);
  console.log("");
  console.log("Step 1/2: Fetching ~3 years of historical data from Yahoo Finance...");

  const candles = await fetchDailyHistory(symbol, 1100);

  if (candles.length === 0) {
    console.error(`❌ No data returned for ${symbol}.`);
    console.error("   Double check the symbol is correct and actually listed");
    console.error("   (.NS for NSE, .BO for BSE-only stocks).");
    process.exit(1);
  }

  if (candles.length < 210) {
    console.warn(
      `⚠️  Only ${candles.length} days of data available — this stock may be ` +
      `too newly listed for reliable EMA200/ADX indicators (need 210+ days). ` +
      `Proceeding anyway, but treat any signals for this stock with extra caution.`
    );
  }

  const outputDir = path.join(process.cwd(), "data", "daily");
  const outputPath = path.join(outputDir, filename);

  const header = "date,open,high,low,close,volume";
  const rows = candles.map(
    c => `${c.date},${c.open},${c.high},${c.low},${c.close},${c.volume}`
  );
  fs.writeFileSync(outputPath, [header, ...rows].join("\n"));

  console.log(`✓ Saved ${candles.length} days of data to data/daily/${filename}`);
  console.log("");
  console.log("Step 2/2: Adding to src/config/stocks.ts...");

  const configPath = path.join(process.cwd(), "src", "config", "stocks.ts");
  let configContent = fs.readFileSync(configPath, "utf-8");

  if (configContent.includes(`symbol: "${symbol}"`)) {
    console.log(`✓ "${name}" is already in stocks.ts — skipping this step.`);
  } else {
    const newEntry = `  { name: "${name}", file: "${filename}", symbol: "${symbol}" },\n`;
    const insertMarker = "];";
    const firstArrayEnd = configContent.indexOf(insertMarker);

    if (firstArrayEnd === -1) {
      console.error(
        "❌ Couldn't automatically edit stocks.ts (unexpected file format). " +
        "Please add this line manually to the ALL_STOCKS array:"
      );
      console.error(newEntry.trim());
      process.exit(1);
    }

    configContent =
      configContent.slice(0, firstArrayEnd) +
      newEntry +
      configContent.slice(firstArrayEnd);

    fs.writeFileSync(configPath, configContent);
    console.log(`✓ Added to src/config/stocks.ts`);
  }

  console.log("");
  console.log("Done! Next steps:");
  console.log(`  1. Run the backtest to see how V8 performs on ${name}:`);
  console.log("     npx tsx src/backtest/backtestAllStocksV8.ts");
  console.log("  2. Restart the API server to pick up the new stock:");
  console.log("     npm run server");
}

main().catch(error => {
  console.error("❌ Failed to add stock:", error);
  process.exit(1);
});
