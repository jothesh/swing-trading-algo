import "dotenv/config";
import crypto from "crypto";

const API_KEY = process.env.GROWW_API_KEY;
const API_SECRET = process.env.GROWW_API_SECRET;

if (!API_KEY || !API_SECRET) {
  throw new Error(
    "GROWW_API_KEY or GROWW_API_SECRET is missing from .env"
  );
}

const growwApiKey: string = API_KEY;
const growwApiSecret: string = API_SECRET;

export async function generateAccessToken(): Promise<string> {
  // Current Unix timestamp in seconds
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Groww requires SHA256(secret + timestamp)
  const checksum = crypto
    .createHash("sha256")
    .update(growwApiSecret + timestamp)
    .digest("hex");

  const response = await fetch(
    "https://api.groww.in/v1/token/api/access",
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${growwApiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        key_type: "approval",
        checksum,
        timestamp,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Groww authentication failed: ${JSON.stringify(data)}`
    );
  }

  if (!data.token) {
    throw new Error(
      `Groww did not return an access token: ${JSON.stringify(data)}`
    );
  }

  return data.token;
}