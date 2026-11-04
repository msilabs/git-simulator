import { defineConfig, devices } from "@playwright/test";

/**
 * ব্রাউজারে end-to-end টেস্ট। আগে `npm run build` করে `out/` বানাতে হয়;
 * টেস্ট চলে সেই স্ট্যাটিক সাইটের ওপর, যেটা ব্যবহারকারীরা আসলে পায়।
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4321", trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node scripts/serve.mjs 4321",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
