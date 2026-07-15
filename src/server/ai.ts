import OpenAI from "openai";
import { detectLanguage, getLanguageInstruction } from "@/src/lib/language";

const systemPrompt = `أنت محرر عربي محترف في منصة Quillora / صياغة بشرية.
حوّل النص إلى أسلوب بشري طبيعي وواضح دون اختراع معلومات جديدة.
احفظ المعنى والأرقام والأسماء، وتجنب الحشو، واجعل النتيجة مناسبة للاستخدام المهني.`;

export async function humanizeWithDeepSeek(text: string, tone: string, strength: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_MISSING");
  const language = detectLanguage(text);
  const languageInstruction = getLanguageInstruction(language);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      temperature: strength === "قوي" ? 0.8 : strength === "خفيف" ? 0.35 : 0.55,
      messages: [
        { role: "system", content: `${systemPrompt}\n\n${languageInstruction}\nHumanize does not mean translate. Return the rewritten text only.` },
        {
          role: "user",
          content: `نمط الكتابة: ${tone}\nقوة التحويل: ${strength}\n\nالنص:\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DEEPSEEK_FAILED_${response.status}`);
  }

  const data = await response.json();
  const output = data?.choices?.[0]?.message?.content?.trim();
  if (!output) throw new Error("DEEPSEEK_EMPTY_OUTPUT");
  return output;
}

export async function humanizeWithOpenAI(text: string, tone: string, strength: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const language = detectLanguage(text);
  const languageInstruction = getLanguageInstruction(language);

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
    temperature: strength === "قوي" ? 0.75 : strength === "خفيف" ? 0.3 : 0.5,
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${languageInstruction}\nHumanize does not mean translate. Return the rewritten text only.` },
      {
        role: "user",
        content: `نمط الكتابة: ${tone}\nقوة التحويل: ${strength}\n\nالنص:\n${text}`,
      },
    ],
  });

  const output = response.choices[0]?.message?.content?.trim();
  if (!output) throw new Error("OPENAI_EMPTY_OUTPUT");
  return output;
}

export async function humanizeText(text: string, tone: string, strength: string, preferOpenAI = false) {
  if (preferOpenAI) {
    return { output: await humanizeWithOpenAI(text, tone, strength), provider: "openai" };
  }

  try {
    return { output: await humanizeWithDeepSeek(text, tone, strength), provider: "deepseek" };
  } catch (error) {
    if (!process.env.OPENAI_API_KEY) throw error;
    return { output: await humanizeWithOpenAI(text, tone, strength), provider: "openai" };
  }
}
