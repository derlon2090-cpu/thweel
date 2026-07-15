import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
