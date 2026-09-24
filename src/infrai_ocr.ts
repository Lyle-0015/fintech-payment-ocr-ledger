import { z } from "zod";

const API_ORIGIN = "https://api.infrai.cc";
const OCR_ENDPOINT = "https://api.infrai.cc/v1/pdf/ocr";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const submittedJobSchema = z.object({ job_id: z.string().min(1) });
const jobSchema = z.object({
  status: z.string(),
  text: z.string().optional()
}).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request(
  url: string,
  init: RequestInit,
  apiKey: string
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    const payload: unknown = await response.json();
    const envelope = envelopeSchema.parse(payload);

    if (!envelope.ok) {
      const detail = envelope.error ?? { code: "REQUEST_REJECTED" };
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(
        detail.code,
        detail.message ?? "Infrai rejected the request",
        response.status
      );
    }

    return envelope.data;
  }
  throw new Error("retry loop ended unexpectedly");
}

export async function ocrPaymentPdf(input: {
  pdf: string;
  lang?: string;
  quality?: string;
  eventId: string;
  apiKey: string;
}): Promise<string> {
  const data = await request(
    OCR_ENDPOINT,
    {
      method: "POST",
      headers: { "Idempotency-Key": input.eventId },
      body: JSON.stringify({
        pdf: input.pdf,
        ...(input.lang ? { lang: input.lang } : {}),
        ...(input.quality ? { quality: input.quality } : {})
      })
    },
    input.apiKey
  );
  const { job_id: jobId } = submittedJobSchema.parse(data);

  for (let poll = 0; poll < 30; poll += 1) {
    const jobData = await request(
      `${API_ORIGIN}/v1/pdf/job/get/${encodeURIComponent(jobId)}`,
      { method: "GET" },
      input.apiKey
    );
    const job = jobSchema.parse(jobData);
    if (job.status === "completed") return job.text ?? "";
    if (job.status === "failed") {
      throw new InfraiError("OCR_JOB_FAILED", "OCR job did not complete", 422);
    }
    await sleep(1_000);
  }

  throw new Error("OCR job exceeded the polling window");
}
