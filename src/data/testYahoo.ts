import { downloadYahooDaily } from "./yahooDownloader";

async function main() {
  try {
    await downloadYahooDaily(
      "CANBK.NS",
      "CANBK"
    );

    console.log("\nDownload completed.");
  } catch (error) {
    console.error("❌ Download failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
}

main();