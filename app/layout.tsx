import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "صياغة بشرية | تحويل النصوص إلى أسلوب بشري",
  description: "واجهة عربية احترافية لتحويل النصوص والملفات إلى صياغة بشرية مع نظام XP وتاريخ تحويلات.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
