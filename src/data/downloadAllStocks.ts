import { stocks } from "../../config/stocks";
import { downloadYahooDaily } from "./yahooDownloader";

async function main() {
  console.log(`Starting download for ${stocks.length} stocks...\n`);

  let success = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      await downloadYahooDaily(
        stock.symbol,
        stock.fileName
      );

      success++;
    } catch (error) {
      failed++;

      console.error(
        `❌ ${stock.name} failed`
      );

      if (error instanceof Error) {
        console.error(error.message);
      }
    }
  }

  console.log("\n============================");
  console.log("DOWNLOAD SUMMARY");
  console.log("============================");
  console.log(`Total:   ${stocks.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed:  ${failed}`);
}

main();