/**
 * ইন্টারফেসের (বোতাম, প্যানেল, ব্যানার, মোডাল) সব বাংলা লেখা।
 * কমান্ডের ব্যাখ্যা আর এরর আছে `git/messages.ts`-এ; এই ফাইল শুধু UI-র জন্য।
 */
import { bn } from "./git/messages";

export const ui = {
  appTitle: "Git শেখার সিমুলেটর",
  tagline: "ভয় না পেয়ে Git চর্চা করুন। এখানে কিছুই নষ্ট হবে না।",
  footer: "msilabs · Free & open source",

  /* ওপরের বার */
  undo: "আগের ধাপে",
  undoLabel: "আগের ধাপে ফিরুন",
  undoTitle: (command: string) => `আগের ধাপে ফিরুন: ${command}`,
  undoNone: "ফেরার মতো কোনো ধাপ নেই",
  help: "help",
  reset: "নতুন করে শুরু",
  saveFailed: "অগ্রগতি সেভ হচ্ছে না। ব্রাউজারের স্টোরেজ বন্ধ বা ভরা থাকতে পারে; পেজ বন্ধ করলে কাজ হারাবে।",
  loadFailed: "আগের সেভ করা অবস্থা পড়া যায়নি, তাই নতুন করে শুরু হলো।",

  /* reset মোডাল */
  resetTitle: "নতুন করে শুরু করবেন?",
  resetBody: "সব ফাইল, commit, branch আর টার্মিনালের লেখা মুছে যাবে। এটা আর ফেরানো যাবে না।",
  resetCancel: "না, থাক",
  resetConfirm: "হ্যাঁ, সব মুছুন",

  /* Error Boundary */
  crashTitle: "কিছু একটা গোলমাল হয়েছে",
  crashBody:
    "সিমুলেটরে একটা সমস্যা হয়েছে। আগে পেজটা আবার চালু করে দেখুন: শেষ কমান্ডের আগ পর্যন্ত আপনার কাজ সেভ করা আছে। তারপরও ঠিক না হলে সব মুছে নতুন করে শুরু করুন।",
  crashReload: "আবার চালু করুন",
  crashReset: "সব মুছে নতুন করে শুরু",

  /* টার্মিনাল */
  terminal: "টার্মিনাল",
  inputLabel: "কমান্ড লিখুন",
  inputPlaceholder: "এখানে লিখুন…",
  stepsTitle: "প্রথম ৫টা কমান্ড (ক্লিক করলেই চলবে):",
  stepNumber: (i: number) => `${bn(i + 1)}. `,

  /* ফাইল প্যানেল */
  filesTitle: "ফাইলের অবস্থা",
  legendLabel: "রঙের মানে",
  workdirTitle: "Working Directory",
  workdirHint: "আপনার ফোল্ডারের ফাইল",
  workdirEmpty: "ফোল্ডার খালি। লিখুন: touch index.html",
  stagingTitle: "Staging Area",
  stagingHint: "পরের commit-এ যা যাবে",
  stagingEmpty: "কিছু নেই। git add দিয়ে এখানে আনুন",
  commitTitle: "শেষ Commit",
  commitHint: "সবশেষ সেভ করা অবস্থা",
  commitEmpty: "এখনো কোনো commit নেই",
  needInit: "আগে git init দিন",
  badgeCommitted: "commit করা",
  emptyFile: "(খালি ফাইল)",
  deletedFile: "(ফাইলটা মুছে গেছে)",
  showContent: (name: string) => `${name}-এর লেখা দেখুন`,
  mergeBannerTitle: "merge চলছে:",
  mergeBanner: (branch: string, count: number) =>
    `${branch} আনতে গিয়ে ${bn(count)}টা ফাইলে conflict। ফাইল ঠিক করে \`git add\`, তারপর \`git commit\`। বাতিল: \`git merge --abort\``,
  mergeResolvedTitle: "সব conflict মেটানো শেষ।",
  mergeResolved: "merge শেষ করতে `git commit` দিন।",
  revertBannerTitle: "revert চলছে:",
  revertBanner: (id: string, count: number) =>
    `commit ${id} উল্টাতে গিয়ে ${bn(count)}টা ফাইলে conflict। ফাইল ঠিক করে \`git add\`, তারপর \`git revert --continue\`। বাতিল: \`git revert --abort\``,
  revertResolved: "revert শেষ করতে `git revert --continue` দিন।",
  stashNote: (count: number) => `stash-এ ${bn(count)}টা অবস্থা সরিয়ে রাখা আছে। দেখতে \`git stash list\`, ফেরাতে \`git stash pop\`।`,

  /* গ্রাফ */
  graphTitle: "Commit গ্রাফ",
  graphLegendHead: "HEAD = আপনি এখানে",
  graphNoCommits: "এখনো কোনো commit নেই।",
  graphNoCommitsHint: "প্রথম commit করলে এখানে একটা বৃত্ত দেখা যাবে।",
  graphNoRepo: "রিপোজিটরি নেই। শুরু করতে টার্মিনালে লিখুন ",
  graphLabel: (commits: number, branches: number, head: string) =>
    `${bn(commits)}টা commit, ${bn(branches)}টা branch; HEAD আছে ${head}-এ`,
  moreBranches: (names: readonly string[]) => `আরও branch: ${names.join(", ")}`,
} as const;
