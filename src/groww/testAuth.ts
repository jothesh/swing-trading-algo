import { generateAccessToken } from "./growwAuth";

async function main() {
  try {
    console.log("Connecting to Groww...");

    const token = await generateAccessToken();

    console.log("✅ Groww authentication successful");
    console.log(
      `Token received: ${token.substring(0, 10)}...`
    );

  } catch (error) {
    console.error("❌ Authentication failed");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }
}

main();