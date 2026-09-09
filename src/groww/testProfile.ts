import { generateAccessToken } from "./growwAuth";

async function main() {
  try {
    console.log("Getting Groww profile...");

    const token = await generateAccessToken();

    const response = await fetch(
      "https://api.groww.in/v1/user/detail",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-API-VERSION": "1.0",
        },
      }
    );

    const data = await response.json();

    console.log("HTTP Status:", response.status);
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error("❌ Failed");

    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();