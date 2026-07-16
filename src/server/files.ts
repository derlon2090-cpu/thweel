import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
        return parsed.text;
      } finally {
        await parser.destroy();
      }
    } catch {
      throw new FileTextExtractionError(
        "PDF_TEXT_EXTRACTION_FAILED",
        "تعذر استخراج نص من ملف PDF. إذا كان الملف صورة أو مسحاً ضوئياً فحوّله إلى نص أولاً ثم ارفعه بصيغة TXT أو DOCX.",
      );
    }
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
