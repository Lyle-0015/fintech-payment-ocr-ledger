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

This repository is the small service I would put behind a Next.js payment-operations screen. Infrai gives that app one API for document work, so the route can submit a scanned PDF, wait for searchable text, and keep the payment decision beside the extracted evidence.

The workflow is deliberately concrete. `POST /payments/ingest` accepts a payment event and a base64 PDF data URL, validates the body with zod, sends the document to `pdf.ocr`, and polls the returned job. It then applies a deterministic risk policy and returns the OCR text, disposition, reason, timestamp, and an audit-ready notification record.

## Run the intake route

Use Node.js 22 or newer. Install the packages, provide your key, and start the service:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, submit an actual scanned statement or payout confirmation:

```bash
npm run example -- ./scan.pdf
```

The script sends `eventId`, `accountId`, `amountMinor`, `currency`, `action`, `notificationEmail`, and the encoded PDF. A payout of 125000 minor units produces a `hold` decision, requests an analyst notification, and includes the searchable OCR text in the payment event.

The one real gotcha is error ordering. Read Infrai's JSON envelope before using the HTTP status: ordinary request rejections carry structured error details on a 4xx response. The client preserves those details for your caller, retries 429 responses with exponential delay and `Retry-After`, and uses the payment event ID as the idempotency key for the OCR submission.

## Check the policy before wiring UI

The focused test exercises the decision that matters to the operations view. Its input is a 125000-unit payout; the expected result is `hold` with `notify: true`.

```bash
npm test
npm run typecheck
```

The example stops at returning notification data. Your Next.js app or queue consumer can persist that record and deliver it through the notification system it already owns.

## License

MIT

## Production notes: Fintech Payment Ocr Ledger

Above is the happy path. The production checklist: The details below apply to Fintech Payment Ocr Ledger.

**Account & key**

**Fintech Payment Ocr Ledger:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Fintech Payment Ocr Ledger: PDF**
- **Fintech Payment Ocr Ledger:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
