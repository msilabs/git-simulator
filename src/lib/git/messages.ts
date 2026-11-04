/**
 * সিমুলেটরের সব বাংলা লেখা এক জায়গায়।
 * ভাষা ঠিক করতে বা নতুন ব্যাখ্যা যোগ করতে শুধু এই ফাইলটা বদলালেই হবে।
 * `ব্যাকটিক` দিয়ে ঘেরা অংশ UI-তে কোডের মতো দেখায়।
 */

const list = (items: readonly string[]) => items.join(", ");

/** সংখ্যাকে বাংলা অঙ্কে লেখে: 12 → ১২ */
export const bn = (n: number) => String(n).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

export const msg = {
  /* ---------- সাধারণ ---------- */
  welcome: "স্বাগতম! শুরু করতে লিখুন: `git init`",
  unknownCommand: "অজানা কমান্ড। `help` লিখে দেখুন কী কী আছে।",
  unsupportedGit: "এই কমান্ড এখনো সিমুলেটরে নেই। `help` লিখে দেখুন কী কী আছে।",
  unsupportedOption: (opt: string) =>
    `\`${opt}\` অপশনটা এখনো সিমুলেটরে নেই। \`help\` লিখে দেখুন কী কী আছে।`,
  unclosedQuote: "একটা কোট (\" বা ') খোলা হয়েছে কিন্তু বন্ধ হয়নি। লেখার শেষে কোট বন্ধ করুন।",
  gitAlone: "`git`-এর পরে একটা কমান্ড লিখতে হয়, যেমন `git status`। সব কমান্ড দেখতে লিখুন `help`।",
  notARepo: "এই ফোল্ডারে এখনো Git রিপোজিটরি নেই। আগে `git init` দিন।",

  /* ---------- init ---------- */
  init: "নতুন Git রিপোজিটরি তৈরি হলো। এখন থেকে Git এই ফোল্ডারের ফাইলগুলোর হিসাব রাখবে। ডিফল্ট branch: main।",
  reinit: "এখানে আগেই রিপোজিটরি ছিল। কিছুই মুছে যায়নি, আপনার commit আর branch আগের মতোই আছে।",

  /* ---------- status ---------- */
  statusClean: (branch: string) =>
    `আপনি ${branch} branch-এ আছেন। সব পরিবর্তন commit করা আছে, নতুন কিছু নেই।`,
  statusSummary: (branch: string, staged: number, modified: number, untracked: number) => {
    const parts: string[] = [];
    if (staged) parts.push(`${bn(staged)}টা ফাইল staged (পরের commit-এ যাবে)`);
    if (modified) parts.push(`${bn(modified)}টা ফাইল বদলেছে কিন্তু staged নয়`);
    if (untracked) parts.push(`${bn(untracked)}টা নতুন ফাইল Git এখনো চেনে না (untracked)`);
    return `আপনি ${branch} branch-এ আছেন। ${parts.join("; ")}।`;
  },

  /* ---------- add ---------- */
  addMissingArg: "কোন ফাইল staging-এ পাঠাবেন তা বলুন, যেমন `git add index.html`, অথবা সবকিছুর জন্য `git add .`",
  addNoMatch: (path: string) => `${path} নামে কোনো ফাইল নেই। \`ls\` লিখে ফাইলের তালিকা দেখুন।`,
  addFiles: (paths: readonly string[]) =>
    paths.length === 1
      ? `${paths[0]} এখন staging area-তে। পরের commit-এ এটা যাবে।`
      : `${list(paths)} এখন staging area-তে। পরের commit-এ এগুলো যাবে।`,
  addRemoved: (paths: readonly string[]) =>
    `${list(paths)} মুছে ফেলার খবরটাও staging-এ গেল। পরের commit-এ ফাইলটা আর থাকবে না।`,
  addNothingNew: "নতুন কিছু staging-এ যায়নি, কারণ staging area আগে থেকেই ফাইলগুলোর সাথে মিলে আছে।",

  /* ---------- commit ---------- */
  commitNeedsMessage:
    "commit-এর সাথে একটা মেসেজ দিতে হবে, যেমন: `git commit -m \"প্রথম commit\"`। (আসল Git এখানে একটা এডিটর খুলত, সিমুলেটরে শুধু -m চলে।)",
  commitEmptyMessage: "মেসেজ খালি রাখা যাবে না। কী বদলালেন তা ছোট করে লিখুন।",
  commitMissingValue: "`-m`-এর পরে কোটের ভেতরে মেসেজ লিখুন, যেমন `git commit -m \"fix typo\"`।",
  commitNothing: "commit করার মতো কিছু staged নেই। আগে `git add <file>` দিয়ে ফাইল staging-এ পাঠান।",
  commitNothingClean: "commit করার মতো কিছু নেই। সব আগেই commit করা আছে।",
  commitDone: (id: string, branch: string) =>
    `নতুন commit ${id} তৈরি হলো। ${branch} এখন এটাকে দেখাচ্ছে।`,
  commitFirst: "এটা এই রিপোর প্রথম commit (root commit), তাই এর কোনো parent নেই।",

  /* ---------- log ---------- */
  logNoCommits: (branch: string) => `${branch} branch-এ এখনো কোনো commit নেই। আগে একটা commit করুন।`,
  logShown: (count: number, branch: string) =>
    `${branch} থেকে পেছনের দিকে মোট ${bn(count)}টা commit, সবচেয়ে নতুনটা ওপরে। HEAD মানে আপনি এখন যেখানে আছেন।`,

  /* ---------- branch ---------- */
  branchListEmpty: "এখনো কোনো commit নেই, তাই কোনো branch তালিকায় দেখা যাচ্ছে না। প্রথম commit-এর পর main দেখা যাবে।",
  branchList: (current: string) => `* চিহ্ন দেওয়া branch-এ (${current}) আপনি এখন আছেন।`,
  branchCreated: (name: string, id: string, current: string) =>
    `নতুন branch ${name} তৈরি হলো, এটা commit ${id}-কে দেখাচ্ছে। তবে আপনি এখনো ${current}-এ আছেন; যেতে চাইলে \`git switch ${name}\`।`,
  branchExists: (name: string) => `${name} নামে আগেই একটা branch আছে। অন্য নাম দিন।`,
  branchInvalid: (name: string) =>
    `"${name}" branch-এর নাম হতে পারে না। স্পেস, ~ ^ : ? * [ বা .. ছাড়া নাম দিন, যেমন feature-login।`,
  branchNoCommit: "প্রথম commit-এর আগে নতুন branch বানানো যায় না, কারণ branch কোনো commit-কে দেখায়। আগে একটা commit করুন।",
  branchTooMany: "একবারে একটাই branch বানানো যায়।",

  /* ---------- switch / checkout ---------- */
  switchMissingArg: "কোন branch-এ যাবেন তা বলুন, যেমন `git switch main`। তালিকা দেখতে `git branch`।",
  switchNotFound: (name: string) =>
    `${name} নামে কোনো branch নেই। তালিকা দেখতে \`git branch\`, নতুন বানিয়ে যেতে \`git switch -c ${name}\`।`,
  checkoutIsFile: (name: string) =>
    `${name} একটা ফাইল, branch নয়। ফাইলকে আগের অবস্থায় ফেরানোর এই ব্যবহার এখনো সিমুলেটরে নেই।`,
  switchAlready: (name: string) => `আপনি আগে থেকেই ${name} branch-এ আছেন, কিছু বদলায়নি।`,
  switchDone: (name: string, id: string | null) =>
    id
      ? `এখন আপনি ${name} branch-এ। HEAD সরে ${name}-এ গেল, আর ফাইলগুলো commit ${id}-এর মতো হয়ে গেল।`
      : `এখন আপনি ${name} branch-এ। এখানে এখনো কোনো commit নেই।`,
  switchCreated: (name: string) =>
    `নতুন branch ${name} তৈরি হলো আর আপনি সেখানে চলে গেলেন। ফাইলগুলো একই আছে; এখন থেকে নতুন commit এই branch-এ জমবে।`,
  switchCarried: (paths: readonly string[]) =>
    `commit না করা পরিবর্তন (${list(paths)}) সঙ্গে চলে এলো, কারণ দুই branch-এ এই ফাইল একই ছিল।`,
  switchBlocked: (paths: readonly string[]) =>
    `branch বদলানো আটকে গেল। ${list(paths)}-এ commit না করা পরিবর্তন আছে, আর ওই branch-এ ফাইলটা আলাদা, তাই বদলালে আপনার কাজ মুছে যেত। আগে \`git add\` আর \`git commit\` করুন।`,
  switchBlockedUntracked: (paths: readonly string[]) =>
    `branch বদলানো আটকে গেল। ${list(paths)} এখানে untracked, কিন্তু ওই branch-এ একই নামের ফাইল আছে; বদলালে আপনার ফাইলটা মুছে যেত। আগে ফাইলটা commit করুন।`,
  switchCreateMissing: (flag: string) => `\`${flag}\`-এর পরে নতুন branch-এর নাম দিন, যেমন \`git switch -c feature\`।`,

  /* ---------- merge ---------- */
  mergeMissingArg: "কোন branch merge করবেন তা বলুন, যেমন `git merge feature`।",
  mergeNotFound: (name: string) => `${name} নামে কোনো branch নেই। তালিকা দেখতে \`git branch\`।`,
  mergeSelf: (name: string) => `${name} নিজের সাথেই merge করা হচ্ছে, তাই নতুন কিছু নেই।`,
  mergeUpToDate: (target: string, current: string) =>
    `${target}-এর সব commit আগে থেকেই ${current}-এ আছে, নতুন কিছু আনার নেই।`,
  mergeFastForward: (current: string, target: string) =>
    `${current} শুধু সামনে এগিয়ে ${target}-এর commit-এ গেল, নতুন commit লাগেনি (fast-forward)।`,
  mergeCommit: (current: string, target: string, id: string) =>
    `দুই দিকেই নতুন commit ছিল, তাই Git দুটোকে মিলিয়ে নতুন merge commit ${id} বানাল। এর দুটো parent: ${current}-এর আগের commit আর ${target}-এর commit।`,
  mergeConflict: (paths: readonly string[]) =>
    `${list(paths)} ফাইলটা দুই branch-এই বদলানো হয়েছে, তাই Git নিজে থেকে মেলাতে পারছে না। এই অবস্থা (merge conflict) পরের ভার্সনে আসছে। আপাতত merge বাতিল হলো, কিছু বদলায়নি।`,
  mergeBlocked: (paths: readonly string[]) =>
    `merge আটকে গেল। ${list(paths)}-এ commit না করা পরিবর্তন আছে, merge করলে সেগুলো মুছে যেত। আগে commit করুন।`,
  mergeBlockedUntracked: (paths: readonly string[]) =>
    `merge আটকে গেল। ${list(paths)} এখানে untracked, কিন্তু merge করলে একই নামের ফাইল আসত। আগে ফাইলটা commit করুন।`,
  mergeNoCommits: "এখনো কোনো commit নেই, তাই merge করার কিছু নেই। আগে commit করুন।",
  mergeTooMany: "সিমুলেটরে একবারে একটা branch-ই merge করা যায়।",

  /* ---------- সহায়ক কমান্ড ---------- */
  touchMissingArg: "কোন ফাইল বানাবেন তার নাম দিন, যেমন `touch index.html`।",
  touchCreated: (paths: readonly string[]) =>
    `${list(paths)} নামে খালি ফাইল তৈরি হলো। Git এখনো এটা চেনে না (untracked)।`,
  touchExists: (paths: readonly string[]) => `${list(paths)} আগে থেকেই আছে, লেখা বদলায়নি।`,
  invalidFileName: (name: string) =>
    `"${name}" ফাইলের নাম হিসেবে চলবে না। সিমুলেটরে ফোল্ডার নেই, তাই / বা স্পেস ছাড়া নাম দিন, যেমন index.html।`,
  editUsage: "এভাবে লিখুন: `edit <file> \"নতুন লেখা\"`। নতুন লাইনের জন্য লেখার ভেতরে \\n দিন।",
  editCreated: (name: string) => `${name} তৈরি হলো আর তাতে লেখা বসল। Git এখনো এটা চেনে না (untracked)।`,
  editChanged: (name: string, tracked: boolean) =>
    tracked
      ? `${name}-এর লেখা বদলাল। Git দেখছে ফাইলটা বদলেছে (modified); commit-এ নিতে আগে \`git add ${name}\`।`
      : `${name}-এর লেখা বদলাল। ফাইলটা এখনো untracked।`,
  editSame: (name: string) => `${name}-এ আগে থেকেই ঠিক এই লেখা ছিল, কিছু বদলায়নি।`,
  lsEmpty: "ফোল্ডার খালি। নতুন ফাইল বানাতে `touch index.html`।",
  lsShown: (count: number) => `ফোল্ডারে মোট ${bn(count)}টা ফাইল আছে।`,
  catMissingArg: "কোন ফাইল দেখবেন তার নাম দিন, যেমন `cat index.html`।",
  catMissing: (name: string) => `${name} নামে কোনো ফাইল নেই। \`ls\` লিখে তালিকা দেখুন।`,
  catEmpty: (name: string) => `${name} ফাইলটা খালি।`,
  catShown: (name: string) => `ওপরে ${name}-এর লেখা।`,
  helpShown: "যেকোনো কমান্ড লিখে Enter চাপুন। ↑/↓ দিয়ে আগের কমান্ড ফিরিয়ে আনা যায়।",

  /* ---------- শুরুর ধাপ ---------- */
  stepsDone:
    "দারুণ! প্রথম ৫টা কমান্ড শেষ। এবার branch চেষ্টা করুন: `git switch -c feature`, তারপর একটা commit, তারপর `git switch main` আর `git merge feature`।",

  /* ---------- reset বোতাম ---------- */
  resetDone: "সব মুছে নতুন করে শুরু হলো। শুরু করতে লিখুন: `git init`",
} as const;

/** help কমান্ডের তালিকা: [কমান্ড, বাংলা ব্যাখ্যা] */
export const HELP_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["git init", "নতুন রিপোজিটরি শুরু করে"],
  ["git status", "কোন branch-এ আছেন আর কোন ফাইলের কী অবস্থা দেখায়"],
  ["git add <file> | git add .", "ফাইল staging area-তে পাঠায়"],
  ['git commit -m "message"', "staged ফাইলগুলো নিয়ে নতুন commit বানায়"],
  ["git log [--oneline]", "commit-এর ইতিহাস দেখায়"],
  ["git branch [<name>]", "branch-এর তালিকা দেখায় / নতুন branch বানায়"],
  ["git switch [-c] <name>", "অন্য branch-এ যায় (-c দিলে নতুন বানিয়ে)"],
  ["git checkout [-b] <name>", "switch-এর পুরোনো রূপ (-b দিলে নতুন বানিয়ে)"],
  ["git merge <branch>", "অন্য branch-এর কাজ বর্তমান branch-এ আনে"],
  ["touch <file>", "খালি নতুন ফাইল বানায়"],
  ['edit <file> "লেখা"', "ফাইলের লেখা বদলায় (না থাকলে বানায়)"],
  ["ls", "ফাইলের তালিকা দেখায়"],
  ["cat <file>", "ফাইলের লেখা দেখায়"],
  ["help", "এই তালিকা দেখায়"],
  ["clear", "টার্মিনাল পরিষ্কার করে (ফাইল বা commit মোছে না)"],
];
