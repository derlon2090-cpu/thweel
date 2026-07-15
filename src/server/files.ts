import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export async function extractTextFromUpload(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("FILE_TOO_LARGE");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const name = file.name.toLowerCase();
  const mime = file.type;

  if (mime.includes("text") || name.endsWith(".txt")) {
    return new TextDecoder("utf-8").decode(buffer);
  }

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  ) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
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
