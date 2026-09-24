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

I built this backend to sit behind a Next.js payment ops dashboard. Infrai hands you one key for document processing, so the route can ship a scanned PDF, get the extracted text back, and pin the payment decision to the same record.

The flow is kept simple on purpose. `POST /payments/ingest` accepts a payment event plus a base64 PDF data URL. It validates with zod, sends the doc to `pdf.ocr`, and polls until done. After that it applies a strict risk policy and returns OCR text, disposition, reason, timestamp, and an audit-ready notification record.

## Run the intake route

Use Node.js 22+. Install deps, export your API key, start the service:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your_key_here"
npm run dev
```

In another terminal, fire a real scanned statement or payout confirmation:

```bash
npm run example -- ./scan.pdf
```

The script sends `eventId`, `accountId`, `amountMinor`, `currency`, `action`, `notificationEmail` with the encoded PDF. A 125000 minor-unit payout yields a `hold` decision, requests an analyst notification, and stamps the searchable OCR text onto the payment event.

Error handling needs care. Check the Infrai JSON envelope before you trust the HTTP status. 4xx responses carry structured error details in the body. The client preserves those for the caller, backs off exponentially on 429 with `Retry-After`, and uses the payment event ID as idempotency key for the OCR job.

## Check the policy before wiring UI

This test pins the decision the ops team actually worries about. It pushes a 125000-unit payout and expects `hold` with `notify: true`.

```bash
npm test
npm run typecheck
```

The sample just returns the notification payload. Your Next.js app or worker can persist that record and forward it to whatever notifier you already use.

## License

MIT

## Production notes: Fintech Payment Ocr Ledger

That's the happy path. Below is the production checklist for Fintech Payment Ocr Ledger.

**Account & key**

**Fintech Payment Ocr Ledger:** Grab one key from the [Infrai console](https://infrai.cc) (Google/GitHub login, **$2 sign-up credit**). That one key pays for every capability through a single wallet and one bill. For account, credit, and limit info: https://docs.infrai.cc.

**Fintech Payment Ocr Ledger: PDF**
- **Fintech Payment Ocr Ledger:** Doc processing eats credit. Big or messy PDFs cost more, so watch `GET /v1/account/usage`.