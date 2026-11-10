import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/components/ThemeToggle";

const bengali = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Git শেখার সিমুলেটর · msilabs",
  description:
    "ব্রাউজারে Git কমান্ড অনুশীলন করুন: নকল টার্মিনাল, সাথে সাথে বদলানো commit গ্রাফ আর বাংলায় ব্যাখ্যা।",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14213D",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme পেজ আঁকার আগে script বসায়, তাই React-এর HTML-এর সাথে না মেলাটা প্রত্যাশিত
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${bengali.variable} ${code.variable} antialiased`}>{children}</body>
    </html>
  );
}
