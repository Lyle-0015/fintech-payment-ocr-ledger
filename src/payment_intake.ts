import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, ocrPaymentPdf } from "./infrai_ocr.js";
import { decidePaymentRisk } from "./risk_decision.js";

const paymentEventSchema = z.object({
  eventId: z.string().min(1),
  accountId: z.string().min(1),
  pdf: z.string().startsWith("data:application/pdf;base64,"),
  lang: z.string().min(2).optional(),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  action: z.enum(["capture", "refund", "payout"]),
  notificationEmail: z.string().email()
});

function sendJson(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown
) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/payments/ingest") {
    sendJson(response, 404, { error: "route not found" });
    return;
  }

  try {
    const event = paymentEventSchema.parse(await readJson(request));
    const apiKey = process.env.INFRAI_API_KEY;
    if (!apiKey) {
      sendJson(response, 503, { error: "INFRAI_API_KEY is required" });
      return;
    }

    const searchableText = await ocrPaymentPdf({
      pdf: event.pdf,
      lang: event.lang,
      eventId: event.eventId,
      apiKey
    });
    const decision = decidePaymentRisk(event);
    const recordedAt = new Date().toISOString();

    sendJson(response, 200, {
      event: {
        eventId: event.eventId,
        accountId: event.accountId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        action: event.action,
        searchableText,
        recordedAt
      },
      decision,
      notification: decision.notify
        ? {
            to: event.notificationEmail,
            subject: `Payment ${event.eventId}: ${decision.disposition}`,
            auditReference: `${event.eventId}:${recordedAt}`
          }
        : null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, { error: "invalid request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    sendJson(response, 500, { error: "payment ingestion failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Payment intake listening on ${port}`));
}
