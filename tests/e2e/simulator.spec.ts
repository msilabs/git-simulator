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
  await expect(log(page)).toContainText("দারুণ! মিশন শেষ: প্রথম commit");
  await expect(page.getByTestId("missions")).toContainText("বদল দেখে আবার commit");
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

test("revert conflict banner, stash note and reset", async ({ page }) => {
  await run(
    page,
    "git init",
    'edit a "a"',
    "git add .",
    'git commit -m "first"',
    'edit a "a2"',
    'git commit -am "second"',
    'edit a "a3"',
    'git commit -am "third"',
    "git revert HEAD~1",
  );
  await expect(page.getByText("revert চলছে:")).toBeVisible();
  await run(page, "git revert --abort", 'edit a "wip"', "git stash");
  await expect(page.getByText("stash-এ ১টা অবস্থা সরিয়ে রাখা আছে।")).toBeVisible();
  await run(page, "git stash pop");
  await expect(page.getByText("stash-এ ১টা অবস্থা")).toHaveCount(0);
  await run(page, "git reset --hard HEAD~1");
  await expect(log(page)).toContainText("HEAD is now at");
  await expect(page.locator("svg circle")).toHaveCount(2);
});

test("two tabs stay in sync instead of overwriting each other's progress", async ({ page, context }) => {
  await run(page, "git init", "touch from-first-tab");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByText("from-first-tab").first()).toBeVisible();

  await run(second, "touch from-second-tab");
  await expect(page.getByText("from-second-tab").first()).toBeVisible();

  await run(page, "touch third");
  await second.reload();
  for (const name of ["from-first-tab", "from-second-tab", "third"]) {
    await expect(second.getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test("Tab completes like a real terminal, and a double Tab lists the matches", async ({ page }) => {
  await run(page, "git init", 'edit index.html "a"', 'edit index.css "b"', 'edit notes.txt "n"');
  const input = page.getByLabel("কমান্ড লিখুন");

  await input.fill("cat no");
  await input.press("Tab");
  await expect(input).toHaveValue("cat notes.txt ");
  await expect(input).toBeFocused();

  await input.fill("cat ind");
  await input.press("Tab");
  await expect(input).toHaveValue("cat index.");
  await input.press("Tab");
  await expect(log(page)).toContainText("index.css  index.html");
  await expect(input).toHaveValue("cat index.");

  // খালি লাইনে Tab focus সরিয়ে দেয়
  await input.fill("");
  await input.press("Tab");
  await expect(input).not.toBeFocused();
});

test("a file can be edited from the file panel, which runs the matching edit command", async ({ page }) => {
  await run(
    page,
    "git init",
    'edit a.txt "base"',
    "git add .",
    'git commit -m "base"',
    "git switch -c f",
    'edit a.txt "theirs"',
    'git commit -am "f"',
    "git switch main",
    'edit a.txt "ours"',
    'git commit -am "m"',
    "git merge f",
  );
  const work = page.locator("section").filter({ hasText: "Working Directory" }).first();
  await work.getByRole("button", { name: /a\.txt-এর লেখা দেখুন/ }).first().click();
  await page.getByRole("button", { name: "a.txt এডিট করুন" }).click();
  const editor = page.getByRole("textbox", { name: "a.txt-এর লেখা" });
  await expect(editor).toHaveValue(/<<<<<<< HEAD/);
  await editor.fill('ours and "theirs"\nsecond line');
  await page.getByRole("button", { name: "সেভ", exact: true }).click();

  await expect(log(page)).toContainText('edit a.txt "ours and \\"theirs\\"\\nsecond line"');
  await run(page, "cat a.txt");
  await expect(log(page)).toContainText("second line");
  await run(page, "git add a.txt", "git commit");
  await expect(log(page)).toContainText("merge শেষ!");
});

test("clone, a teammate's push, fetch and pull", async ({ page }) => {
  await run(page, "git clone https://github.com/msilabs/demo.git");
  await expect(log(page)).toContainText("Cloning into 'demo'...");
  const graph = page.locator("svg").filter({ hasText: "origin/main" });
  await expect(graph).toBeVisible();
  await run(page, 'teammate notes.txt "hello"', "git status");
  await expect(log(page)).toContainText("Your branch is up to date with 'origin/main'.");
  await run(page, "git fetch", "git status");
  await expect(log(page)).toContainText("Your branch is behind 'origin/main' by 1 commit");
  await run(page, "git pull");
  await expect(log(page)).toContainText("Fast-forward");
  await expect(page.getByRole("button", { name: /notes\.txt-এর লেখা দেখুন/ }).first()).toBeVisible();
});

test("follows the system theme, and the toggle switches and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "আলো / অন্ধকার থিম বদলান" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(245, 247, 251)");
});

test("a tall file panel scrolls instead of pushing the graph out of the page", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "on phones the page simply scrolls");
  await run(
    page,
    "git init",
    'edit index.html "<h1>hi</h1>"',
    "git add .",
    'git commit -m "first"',
    "git switch -c f",
    'edit index.html "F"',
    'git commit -am "f"',
    "git switch main",
    'edit index.html "M"',
    'git commit -am "m"',
    "git merge f",
    "touch notes.txt",
  );
  await page.getByRole("button", { name: /index\.html-এর লেখা দেখুন/ }).first().click();
  const main = (await page.locator("main").boundingBox())!;
  const graph = (await page.locator("section").filter({ hasText: "Commit গ্রাফ" }).first().boundingBox())!;
  expect(graph.y + graph.height).toBeLessThanOrEqual(main.y + main.height + 1);
});
