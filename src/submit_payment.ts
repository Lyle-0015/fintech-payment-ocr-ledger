import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run example -- ./scan.pdf");
  process.exit(1);
}

const pdf = await readFile(path);
const response = await fetch("http://localhost:3000/payments/ingest", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    eventId: "evt_2026_09_001",
    accountId: "merchant_2048",
    pdf: `data:application/pdf;base64,${pdf.toString("base64")}`,
    lang: "eng",
    amountMinor: 125_000,
    currency: "USD",
    action: "payout",
    notificationEmail: "risk@example.com"
  })
});

const result: unknown = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok) process.exitCode = 1;
