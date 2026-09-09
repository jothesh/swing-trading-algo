import { getHistoricalCandles } from "./historicalData";

async function main() {
  try {
    console.log("Fetching CANBK historical data...");

    const candles = await getHistoricalCandles(
      "NSE-CANBK",
      "2026-08-20 09:15:00",
      "2026-08-20 15:30:00",
      "1day"
    );

    console.log(`Received ${candles.length} candles`);

    console.table(candles);

  } catch (error) {
    console.error("❌ Failed");

    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();