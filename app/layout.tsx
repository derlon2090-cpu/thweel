import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QUILLORA | صياغة بشرية",
  description: "منصة عربية احترافية لتحويل النصوص والملفات إلى صياغة بشرية refined human writing مع نظام XP وتاريخ تحويلات.",
  icons: {
    icon: "/quillora-logo.png",
    shortcut: "/quillora-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}
