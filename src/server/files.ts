import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export class FileTextExtractionError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = "FileTextExtractionError";
    this.code = code;
    this.status = status;
  }
}

function decodeTextBuffer(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (utf8.replace(/\uFFFD/g, "").trim().length > 0) return utf8;
  return new TextDecoder("windows-1256", { fatal: false }).decode(buffer);
}

function extractXmlText(xml: string) {
  return xml
    .replace(/<w:tab\s*\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function roughDocxXmlFallback(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const documentStart = text.indexOf("<w:document");
  if (documentStart === -1) return "";
  const documentEnd = text.indexOf("</w:document>", documentStart);
  if (documentEnd === -1) return "";
  return extractXmlText(text.slice(documentStart, documentEnd + "</w:document>".length));
}

function decodePdfEscapedString(input: string) {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function usefulTextScore(input: string) {
  const cleaned = input.trim();
  if (cleaned.length < 2) return 0;
  const useful = (cleaned.match(/[\p{Script=Arabic}A-Za-z0-9 .,;:!?()\-\n]/gu) || []).length;
  const letters = (cleaned.match(/[\p{L}\p{N}]/gu) || []).length;
  return (useful / cleaned.length) * 0.7 + Math.min(letters / 20, 1) * 0.3;
}

function decodePdfHexText(hex: string) {
  const bytes = Buffer.from(hex, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const chars: string[] = [];
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      chars.push(String.fromCharCode((bytes[index] << 8) | bytes[index + 1]));
    }
    return chars.join("");
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString("utf16le");
  }
  return bytes.toString("utf8");
}

function extractPdfTextFromStream(stream: Buffer) {
  const candidates: string[] = [];
  const asLatin = stream.toString("latin1");
  const literalMatches = asLatin.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g);
  for (const match of literalMatches) {
    const raw = match[0].replace(/\)\s*Tj$/, "").slice(1);
    candidates.push(decodePdfEscapedString(raw));
  }

  const arrayMatches = asLatin.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
  for (const match of arrayMatches) {
    const parts = [...match[1].matchAll(/\((?:\\.|[^\\)])+\)/g)].map((part) => decodePdfEscapedString(part[0].slice(1, -1)));
    if (parts.length) candidates.push(parts.join(""));
  }

  const hexMatches = asLatin.matchAll(/<([0-9A-Fa-f\s]{4,})>\s*Tj/g);
  for (const match of hexMatches) {
    const hex = match[1].replace(/\s+/g, "");
    try {
      candidates.push(decodePdfHexText(hex));
    } catch {
      // Ignore malformed PDF text fragments.
    }
  }

  return candidates.filter((candidate) => usefulTextScore(candidate) > 0.45).join("\n");
}

function roughPdfTextFallback(buffer: Buffer) {
  const chunks: string[] = [];
  const source = buffer.toString("latin1");
  const streamMatches = source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g);
  for (const match of streamMatches) {
    const raw = Buffer.from(match[1], "latin1");
    chunks.push(extractPdfTextFromStream(raw));
    try {
      chunks.push(extractPdfTextFromStream(inflateSync(raw)));
    } catch {
      // Not every PDF stream is flate-compressed.
    }
  }

  return chunks
    .join("\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfWithOpenAIOcr(file: File, buffer: Buffer) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const uploaded = await client.files.create({
    file: new File([new Uint8Array(buffer)], file.name || "document.pdf", { type: file.type || "application/pdf" }),
    purpose: "assistants",
  });

  try {
    const response = await (client as any).responses.create({
      model: process.env.OPENAI_OCR_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "استخرج النص المقروء من ملف PDF كما هو قدر الإمكان. لا تلخص، لا تشرح، ولا تضف معلومات. إذا لم تجد نصاً مقروءاً فأعد نصاً فارغاً فقط.",
            },
            { type: "input_file", file_id: uploaded.id },
          ],
        },
      ],
    });

    return String(response.output_text || "").trim();
  } finally {
    await client.files.delete(uploaded.id).catch(() => undefined);
  }
}

export async function extractTextFromUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileTextExtractionError("FILE_TOO_LARGE", "حجم الملف يتجاوز الحد الأقصى 20MB.", 413);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const name = file.name.toLowerCase();
  const mime = file.type;

  if (mime.includes("text") || name.endsWith(".txt")) {
    return decodeTextBuffer(buffer);
  }

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        if (parsed.text.trim()) return parsed.text;
      } finally {
        await parser.destroy();
      }
    } catch {
      // Continue to fallback extractors below.
    }

    const roughText = roughPdfTextFallback(buffer);
    if (roughText) return roughText;

    const ocrText = await extractPdfWithOpenAIOcr(file, buffer);
    if (ocrText) return ocrText;

    throw new FileTextExtractionError(
      "PDF_OCR_REQUIRED",
      "هذا PDF مصوّر ولا يحتوي نصاً قابلاً للنسخ. فعّل OPENAI_API_KEY في Vercel ليعمل OCR تلقائياً، أو ارفع ملفاً نصياً TXT/DOCX.",
    );
  }

  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    try {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      if (parsed.value.trim()) return parsed.value;
    } catch {
      // Try the lightweight fallback below.
    }
    const fallbackText = roughDocxXmlFallback(buffer);
    if (fallbackText) return fallbackText;
    throw new FileTextExtractionError(
      "DOCX_TEXT_EXTRACTION_FAILED",
      "تعذر استخراج النص من ملف Word. جرّب حفظ الملف بصيغة DOCX حديثة أو TXT ثم أعد الرفع.",
    );
  }

  throw new FileTextExtractionError("UNSUPPORTED_FILE_TYPE", "نوع الملف غير مدعوم. الرجاء رفع PDF أو DOCX أو TXT.", 415);
}

export async function saveUploadedFile(userId: string, file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 120);
  const dir = path.join(process.cwd(), ".quillora-storage", userId);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${Date.now()}-${randomUUID()}-${safeName}`);
  await writeFile(storagePath, buffer);
  return storagePath;
}

export async function outputBuffer(text: string, format: string) {
  const normalized = format.toLowerCase();
  if (normalized === "docx") {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: text.split(/\n{2,}/).map(
            (paragraph) =>
              new Paragraph({
                bidirectional: true,
                children: [new TextRun({ text: paragraph.trim() })],
              }),
          ),
        },
      ],
    });
    return {
      buffer: Buffer.from(await Packer.toBuffer(doc)),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      extension: "docx",
    };
  }

  if (normalized === "pdf") {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = text.replace(/\r/g, "").split("\n").flatMap((line) => line.match(/.{1,80}/g) ?? [""]);
    let y = 790;
    for (const line of lines.slice(0, 48)) {
      page.drawText(line, { x: 45, y, size: 11, font, color: rgb(0.04, 0.09, 0.2) });
      y -= 17;
    }
    return {
      buffer: Buffer.from(await pdf.save()),
      contentType: "application/pdf",
      extension: "pdf",
    };
  }

  return {
    buffer: Buffer.from(text, "utf-8"),
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
  };
}
