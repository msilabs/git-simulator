import { expect, test, type Page } from "@playwright/test";

const run = async (page: Page, ...commands: string[]) => {
  const input = page.getByLabel("কমান্ড লিখুন");
  for (const c of commands) {
    await input.fill(c);
    await input.press("Enter");
  }
};
const log = (page: Page) => page.getByTestId("terminal-log");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(log(page).getByText("স্বাগতম! শুরু করতে লিখুন:")).toBeVisible();
});

test("the five starter steps can be clicked through", async ({ page }) => {
  for (const cmd of ["git init", "touch index.html", "git add index.html", 'git commit -m "first commit"', "git log"]) {
    await page.getByRole("button", { name: cmd }).click();
  }
  await expect(log(page)).toContainText("দারুণ! প্রথম ৫টা কমান্ড শেষ।");
  await expect(log(page)).toContainText("(HEAD -> main)");
  await expect(page.locator("svg circle")).toHaveCount(1);
});

test("branch, conflict, resolve and merge commit", async ({ page }) => {
  await run(
    page,
    "git init",
    'edit index.html "<h1>hello</h1>"',
    "git add .",
    'git commit -m "first"',
    "git switch -c feature",
    'edit index.html "<h1>Welcome</h1>"',
    "git add .",
    'git commit -m "welcome"',
    "git switch main",
    'edit index.html "<h1>Home</h1>"',
    "git add .",
    'git commit -m "home"',
    "git merge feature",
  );
  await expect(log(page)).toContainText("CONFLICT (content): Merge conflict in index.html");
  await expect(page.getByText("merge চলছে:")).toBeVisible();
  await run(page, 'edit index.html "<h1>Welcome Home</h1>"', "git add index.html", "git commit");
  await expect(log(page)).toContainText("Merge branch 'feature'");
  await expect(page.getByText("merge চলছে:")).toHaveCount(0);
  await expect(page.locator("svg circle")).toHaveCount(5); // ৪টা commit, merge commit-এ দুটো বৃত্ত
});

test("progress and undo survive a reload", async ({ page }) => {
  await run(page, "git init", "touch a.txt", "git add .", 'git commit -m "a"');
  await page.reload();
  await expect(log(page)).toContainText('git commit -m "a"');
  await expect(page.locator("svg circle")).toHaveCount(1);
  await page.getByRole("button", { name: "আগের ধাপে ফিরুন" }).click();
  await expect(log(page)).toContainText("আগের ধাপে ফেরা হলো");
  await expect(page.locator("svg circle")).toHaveCount(0);
});

test("corrupt saved data does not break the page", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem("msilabs-git-simulator:v1", JSON.stringify({ v: 1, sim: { repo: null }, lines: [], history: [] })),
  );
  await page.reload();
  await expect(log(page).getByText("আগের সেভ করা অবস্থা পড়া যায়নি")).toBeVisible();
  await run(page, "git init");
  await expect(log(page)).toContainText("Initialized empty Git repository");
});

test("tapping a file shows its content", async ({ page }) => {
  await run(page, 'edit notes.txt "hello from notes"');
  await page.getByRole("button", { name: /notes\.txt-এর লেখা দেখুন/ }).first().click();
  await expect(page.getByText("hello from notes", { exact: true })).toBeVisible();
});

test("reset asks first, then clears everything", async ({ page }) => {
  await run(page, "git init", "touch a");
  await page.getByRole("button", { name: "নতুন করে শুরু" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "হ্যাঁ, সব মুছুন" }).click();
  await expect(log(page).getByText("সব মুছে নতুন করে শুরু হলো")).toBeVisible();
  await expect(page.getByText("ফোল্ডার খালি।")).toBeVisible();
});

test("no horizontal scroll on a 320px screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await run(page, "git init", "touch a", "git add .", 'git commit -m "a"', "git branch a-long-branch-name");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
});
