import { getServerSession } from "next-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth/options";
import { businessesQ } from "@/lib/db/queries";
import { enforceRateLimit, getRequestRateLimitKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_PROMPT_CHARS = 10_000;
const InvoiceDraftSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(80),
  clientName: z.string().trim().min(1).max(160),
  clientEmail: z.string().trim().email().max(254).or(z.literal("")),
  clientAddress: z.string().max(500).default(""),
  businessName: z.string().max(160).default(""),
  businessEmail: z.string().email().max(254).or(z.literal("")).default(""),
  businessAddress: z.string().max(500).default(""),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SEK", "NOK", "DKK"]),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().max(1_000_000),
    unitPrice: z.number().nonnegative().max(99_999_999.99),
  })).min(1).max(200),
  taxRate: z.number().min(0).max(100).default(0),
  discountRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(5000).default(""),
});

function promptFor(today: string, defaultDue: string, content: string) {
  return `Extract an invoice draft from the supplied user content. Return exactly one JSON object and no markdown. Do not invent email addresses, street addresses, business details, dates, tax rates, or line items. Use an empty string for unknown contact/address fields. Use ${today} for a missing issue date and ${defaultDue} for a missing due date. JSON fields: invoiceNumber, clientName, clientEmail, clientAddress, businessName, businessEmail, businessAddress, issueDate (YYYY-MM-DD), dueDate (YYYY-MM-DD), currency (USD|EUR|GBP|CAD|AUD|JPY|SEK|NOK|DKK), items (array of description, numeric quantity, numeric unitPrice), taxRate, discountRate, notes. User content follows:\n${content}`;
}

function parseOutput(text: string) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid AI output");
    value = JSON.parse(match[0]);
  }
  return InvoiceDraftSchema.parse(value);
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function generateDraft(content: string, isPdf?: Uint8Array) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const modelName = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || !modelName) throw new Error("AI parsing is not configured");
  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + 30);
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
  const prompt = promptFor(now.toISOString().slice(0, 10), due.toISOString().slice(0, 10), content);
  const result = isPdf
    ? await model.generateContent([prompt, { inlineData: { data: Buffer.from(isPdf).toString("base64"), mimeType: "application/pdf" } }])
    : await model.generateContent(prompt);
  return parseOutput(result.response.text());
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessId = session?.user?.businessId;
  if (!userId || !businessId) return NextResponse.json({ error: "Sign in to use invoice parsing" }, { status: 401 });
  const [business] = await businessesQ.findByIdForUser(businessId, userId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ error: "AI parsing is not configured" }, { status: 503 });
  }
  if (!process.env.GEMINI_MODEL?.trim()) return NextResponse.json({ error: "AI model is not configured" }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body must be 5 MB or smaller" }, { status: 413 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  try {
    enforceRateLimit(`ai-parse:${businessId}:${getRequestRateLimitKey(ip, userId)}`, 20, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Too many AI parsing requests. Try again later." }, { status: 429 });
  }

  try {
    const body = await readBoundedBody(request);
    const contentType = request.headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const blob = new Blob([body.buffer as ArrayBuffer]);
      const form = await new Response(blob, { headers: { "content-type": contentType } }).formData();
      const promptValue = form.get("prompt");
      const extraText = typeof promptValue === "string" ? promptValue.trim() : "";
      const fileValue = form.get("file");
      if (fileValue instanceof File) {
        if (fileValue.size > MAX_BODY_BYTES) return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 413 });
        const extension = fileValue.name.split(".").pop()?.toLowerCase();
        if (extension === "pdf" && fileValue.type === "application/pdf") {
          const fileBytes = new Uint8Array(await fileValue.arrayBuffer());
          if (new TextDecoder().decode(fileBytes.slice(0, 5)) !== "%PDF-") return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 });
          return NextResponse.json({ success: true, data: await generateDraft(extraText, fileBytes) }, { headers: { "Cache-Control": "no-store" } });
        }
        if (["txt", "md"].includes(extension || "") && (fileValue.type === "text/plain" || fileValue.type === "text/markdown" || fileValue.type === "")) {
          const fileText = await fileValue.text();
          if (fileText.length + extraText.length > MAX_PROMPT_CHARS) return NextResponse.json({ error: "Text input is too long" }, { status: 413 });
          return NextResponse.json({ success: true, data: await generateDraft(`${fileText}\n${extraText}`) }, { headers: { "Cache-Control": "no-store" } });
        }
        return NextResponse.json({ error: "Only PDF, Markdown, or plain text files are supported" }, { status: 415 });
      }
      if (!extraText || extraText.length > MAX_PROMPT_CHARS) return NextResponse.json({ error: "Enter text up to 10,000 characters" }, { status: 400 });
      return NextResponse.json({ success: true, data: await generateDraft(extraText) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!contentType.toLowerCase().includes("application/json")) return NextResponse.json({ error: "Unsupported content type" }, { status: 415 });
    let parsedBody: unknown;
    try { parsedBody = JSON.parse(new TextDecoder().decode(body)); } catch { return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 }); }
    const promptValue = parsedBody && typeof parsedBody === "object" ? (parsedBody as { prompt?: unknown }).prompt : undefined;
    if (typeof promptValue !== "string" || !promptValue.trim() || promptValue.length > MAX_PROMPT_CHARS) {
      return NextResponse.json({ error: "Enter text up to 10,000 characters" }, { status: 400 });
    }
    const draft = await generateDraft(promptValue.trim());
    return NextResponse.json({ success: true, data: draft }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "Request body is too large") return NextResponse.json({ error: "Request body must be 5 MB or smaller" }, { status: 413 });
    return NextResponse.json({ error: "AI parsing failed; review the input and try again" }, { status: 502 });
  }
}
