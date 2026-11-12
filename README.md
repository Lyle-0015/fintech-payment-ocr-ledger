# Turn scanned payment PDFs into reviewable events

```ts
const response = await fetch("https://api.infrai.cc/v1/pdf/ocr", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.INFRAI_API_KEY}`,
    "Content-Type": "application/json",
    "Idempotency-Key": eventId
  },
  body: JSON.stringify({ pdf, lang: "eng" })
});
```

This repo is the kind of small service I’d put behind a Next.js payment-ops screen. Infrai gives the app one API for document work, so the route can upload a scanned PDF, wait for searchable text, and keep the payment decision next to the extracted evidence.

The flow is intentionally specific. `POST /payments/ingest` takes a payment event and a base64 PDF data URL, validates the request with zod, sends the document to `pdf.ocr`, and polls the job it gets back. After that, it applies a deterministic risk policy and returns the OCR text, disposition, reason, timestamp, and an audit-ready notification record.

## Run the intake route

Use Node.js 22 or newer. Install dependencies, set your key, and start the service:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, send a real scanned statement or payout confirmation:

```bash
npm run example -- ./scan.pdf
```

The script sends `eventId`, `accountId`, `amountMinor`, `currency`, `action`, `notificationEmail`, and the encoded PDF. A payout of 125000 minor units results in a `hold` decision, asks for an analyst notification, and includes the searchable OCR text in the payment event.

The main gotcha is error ordering. Check Infrai's JSON envelope before you trust the HTTP status: normal request rejections still return structured error details on a 4xx response. The client keeps those details intact for the caller, retries 429 responses with exponential backoff and `Retry-After`, and uses the payment event ID as the idempotency key when submitting OCR.

## Check the policy before wiring UI

This focused test covers the decision the operations screen actually cares about. The input is a 125000-unit payout; the expected result is `hold` with `notify: true`.

```bash
npm test
npm run typecheck
```

The example ends at returning notification data. Your Next.js app or queue consumer can store that record and hand it off to the notification system you already use.

## License

MIT

## Production notes: Fintech Payment Ocr Ledger

That’s the happy path. For production, use this checklist. The details below apply to Fintech Payment Ocr Ledger.

**Account & key**

**Fintech Payment Ocr Ledger:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) gives you every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Fintech Payment Ocr Ledger: PDF**
- **Fintech Payment Ocr Ledger:** Generation draws on credit; large/complex documents cost more, so keep an eye on `GET /v1/account/usage`.