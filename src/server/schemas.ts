import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم قصير جداً").max(120),
  email: z.string().trim().email("البريد الإلكتروني غير صحيح").max(180),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

export const textHumanizeSchema = z.object({
  text: z.string().trim().min(10, "أدخل نصاً أطول للتحويل").max(50000),
  tone: z.string().trim().default("سردي طبيعي"),
  strength: z.string().trim().default("متوسط"),
  preserveMeaning: z.boolean().default(true),
  noNewInfo: z.boolean().default(true),
});

export const estimateSchema = z.object({
  text: z.string().default(""),
});
