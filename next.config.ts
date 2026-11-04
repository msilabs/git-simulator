import type { NextConfig } from "next";

/**
 * সম্পূর্ণ স্ট্যাটিক সাইট (`out/` ফোল্ডারে), তাই Vercel বা GitHub Pages দুই জায়গাতেই চলে।
 * GitHub Pages-এ সাইট থাকে https://msilabs.github.io/git-simulator/-এ, তাই সেখানে
 * BASE_PATH=/git-simulator দিয়ে build করা হয় (দেখুন .github/workflows/pages.yml)।
 */
const basePath = process.env.BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
