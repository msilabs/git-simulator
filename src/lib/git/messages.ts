/**
 * সিমুলেটরের সব বাংলা লেখা এক জায়গায়।
 * ভাষা ঠিক করতে বা নতুন ব্যাখ্যা যোগ করতে শুধু এই ফাইলটা বদলালেই হবে।
 * `ব্যাকটিক` দিয়ে ঘেরা অংশ UI-তে কোডের মতো দেখায়।
 */

const list = (items: readonly string[]) => items.join(", ");

type Operation = "merge" | "revert" | "stash";

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
  commitAll: (paths: readonly string[], untracked: readonly string[]) =>
    `\`-a\` দিয়ে ${list(paths)}-এর বদল নিজে থেকেই staged হলো (আলাদা করে \`git add\` লাগেনি)।` +
    (untracked.length
      ? ` তবে নতুন untracked ফাইল (${list(untracked)}) \`-a\`-তে যায় না; সেগুলোর জন্য আগে \`git add\` দিতে হয়।`
      : ""),

  /* ---------- log ---------- */
  logNoCommits: (branch: string) => `${branch} branch-এ এখনো কোনো commit নেই। আগে একটা commit করুন।`,
  logShown: (count: number, branch: string | null) =>
    branch
      ? `${branch} থেকে পেছনের দিকে মোট ${bn(count)}টা commit, সবচেয়ে নতুনটা ওপরে। HEAD মানে আপনি এখন যেখানে আছেন।`
      : `সব branch মিলিয়ে মোট ${bn(count)}টা commit, সবচেয়ে নতুনটা ওপরে। HEAD মানে আপনি এখন যেখানে আছেন।`,
  logGraph:
    "বাঁ পাশের রেখাগুলো ইতিহাসের ছবি: `*` একেকটা commit, `|` একই শাখা নিচে চলেছে, `|\\` শাখা আলাদা হলো (merge-এর দুই parent), `|/` দুই শাখা এক জায়গায় মিলল।",
  logGraphNeedsOneline: "সিমুলেটরে `--graph` শুধু `--oneline`-এর সাথে চলে: `git log --oneline --graph` (সব branch দেখতে সাথে `--all`)।",

  /* ---------- show ---------- */
  showShown: (id: string) => `commit ${id}-এর বিবরণ, আর তার আগের commit থেকে কী বদলেছে: \`-\` লাইন বাদ গেছে, \`+\` লাইন যোগ হয়েছে।`,
  showMerge: (id: string) =>
    `${id} একটা merge commit (দুই parent)। সাধারণ merge-এ নতুন কোনো লাইন লেখা হয় না, তাই আসল Git-ও এখানে diff প্রায় দেখায় না।`,
  showUnknown: (rev: string) => `"${rev}" নামে কোনো commit নেই। \`git log --oneline\` দিয়ে id দেখুন, অথবা \`HEAD\`, \`HEAD~1\` লিখুন।`,
  showTooMany: "সিমুলেটরে একবারে একটা commit-ই দেখা যায়।",

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
  mergeConflict: (paths: readonly string[], target: string) =>
    `${list(paths)}-এ দুই branch একই জায়গা আলাদাভাবে বদলেছে, তাই Git নিজে মেলাতে পারল না (merge conflict)। ভয় নেই, কিছু হারায়নি! \`cat ${paths[0]}\` দিয়ে দেখুন: <<<<<<< HEAD-এর নিচে আপনার অংশ, ======= এর পরে ${target}-এর অংশ। \`edit\` দিয়ে যেমন রাখতে চান লিখুন, তারপর \`git add ${paths[0]}\` আর \`git commit\`। বাতিল করতে \`git merge --abort\`।`,
  mergeAutoMerged: (paths: readonly string[]) =>
    `${list(paths)}-এ দুই দিকের বদল আলাদা লাইনে ছিল, তাই Git নিজেই মিলিয়ে নিল।`,
  mergeBlocked: (paths: readonly string[]) =>
    `merge আটকে গেল। ${list(paths)}-এ commit না করা পরিবর্তন আছে, merge করলে সেগুলো মুছে যেত। আগে commit করুন।`,
  mergeBlockedUntracked: (paths: readonly string[]) =>
    `merge আটকে গেল। ${list(paths)} এখানে untracked, কিন্তু merge করলে একই নামের ফাইল আসত। আগে ফাইলটা commit করুন।`,
  mergeNoCommits: "এখনো কোনো commit নেই, তাই merge করার কিছু নেই। আগে commit করুন।",
  mergeTooMany: "সিমুলেটরে একবারে একটা branch-ই merge করা যায়।",
  mergeInProgressUnmerged:
    "আগের merge এখনো শেষ হয়নি, কিছু conflict মেটানো বাকি। আগে conflict মেটিয়ে `git add` আর `git commit` করুন, অথবা `git merge --abort`।",
  mergeInProgressResolved: "আগের merge-এর সব conflict মেটানো হয়েছে, এখন শুধু `git commit` দিয়ে শেষ করুন।",
  mergeAbortNone: "এখন কোনো merge চলছে না, তাই বাতিল করার কিছু নেই।",
  mergeAborted: "merge বাতিল হলো। সব ফাইল merge শুরুর আগের অবস্থায় ফিরে গেল, যেন কিছুই হয়নি।",
  mergeContinueNone: "এখন কোনো merge চলছে না।",

  /* ---------- merge conflict চলাকালীন ---------- */
  statusMerging: (kind: "merge" | "revert", unmerged: number) =>
    unmerged
      ? `${kind} চলছে। ${bn(unmerged)}টা ফাইলে conflict মেটানো বাকি ("Unmerged paths")। ফাইল ঠিক করে \`git add <file>\` দিন।`
      : kind === "merge"
        ? "merge চলছে, সব conflict মেটানো হয়েছে। এখন `git commit` দিলে merge commit তৈরি হবে।"
        : "revert চলছে, সব conflict মেটানো হয়েছে। এখন `git revert --continue` দিলে revert commit তৈরি হবে।",
  statusStashConflict: (unmerged: number) =>
    `stash ফেরাতে গিয়ে ${bn(unmerged)}টা ফাইলে conflict হয়েছে ("Unmerged paths")। ফাইল ঠিক করে \`git add <file>\` দিন। অন্য বদলগুলো staged আছে।`,
  commitUnmerged: (paths: readonly string[]) =>
    `${list(paths)}-এর conflict এখনো মেটানো হয়নি। ফাইল ঠিক করে \`git add ${paths[0]}\` দিন, তারপর commit করুন।`,
  commitWithMarkers: (paths: readonly string[]) =>
    `সাবধান: \`-a\` conflict মেটানো বাকি থাকা ফাইলও (${list(paths)}) তাদের <<<<<<< ======= >>>>>>> চিহ্নসহ commit করে ফেলল। আসল Git-ও এটাই করে। সাধারণত আগে \`edit\` দিয়ে চিহ্নগুলো মুছে তারপর commit করতে হয়।`,
  commitMergeDone: (id: string, branch: string, target: string) =>
    `merge শেষ! নতুন merge commit ${id} তৈরি হলো, এর দুটো parent: ${branch}-এর আগের commit আর ${target}-এর commit।`,
  addResolved: (paths: readonly string[]) => `${list(paths)}-এর conflict মেটানো হয়েছে বলে চিহ্নিত হলো।`,
  addResolvedAll: "সব conflict মেটানো শেষ। এখন `git commit` দিয়ে merge শেষ করুন।",
  addStillMarkers: (paths: readonly string[]) =>
    `সাবধান: ${list(paths)}-এ এখনো <<<<<<< বা >>>>>>> চিহ্ন আছে। Git আপত্তি করবে না, কিন্তু সাধারণত এগুলো মুছে ফেলতে হয়।`,
  switchMerging: (kind: Operation) =>
    kind === "stash"
      ? "stash ফেরানোর conflict মেটানো বাকি থাকলে অন্য branch-এ যাওয়া যায় না। আগে ফাইল ঠিক করে `git add`, অথবা `git restore --staged <file>`।"
      : kind === "merge"
      ? "merge চলাকালীন branch বদলানো যায় না। আগে conflict মিটিয়ে `git commit` দিন, অথবা `git merge --abort`।"
      : "revert চলাকালীন branch বদলানো যায় না। আগে conflict মিটিয়ে `git revert --continue` দিন, অথবা `git revert --abort`।",

  /* ---------- diff ---------- */
  diffNone: "কোনো পার্থক্য নেই: working directory আর staging area একই। (নতুন untracked ফাইল git diff-এ দেখায় না।)",
  diffNoneStaged: "staging area আর শেষ commit একই, তাই commit-এ যাওয়ার মতো নতুন কিছু নেই।",
  diffShown:
    "এটা working directory বনাম staging area: এখনো staged নয় এমন বদল। `-` লাইন বাদ গেছে, `+` লাইন যোগ হয়েছে। staged বদল দেখতে `git diff --staged`।",
  diffShownStaged: "এটা staging area বনাম শেষ commit: পরের commit-এ ঠিক এই বদলগুলো যাবে।",
  diffUnknownPath: (path: string) => `${path} নামে কোনো ফাইল নেই। \`ls\` দিয়ে তালিকা দেখুন।`,
  diffRevisionUnsupported: (arg: string) =>
    `\`${arg}\` দিয়ে commit বা branch তুলনা এখনো সিমুলেটরে নেই। এখন শুধু \`git diff\` আর \`git diff --staged\` চলে।`,

  /* ---------- restore ---------- */
  restoreMissingArg: "কোন ফাইল ফেরাবেন তা বলুন, যেমন `git restore index.html`, অথবা সবকিছুর জন্য `git restore .`",
  restoreNoMatch: (path: string) =>
    `${path} Git চেনে না (untracked বা নেই), তাই ফেরানোর মতো কোনো আগের অবস্থা নেই।`,
  restoreUnmerged: (path: string) =>
    `${path}-এ conflict চলছে, তাই শুধু ফাইল ফেরানো যায় না। ফাইল ঠিক করে \`git add ${path}\` দিন, অথবা \`git restore --staged ${path}\` দিয়ে শেষ commit-এর সংস্করণে মিটিয়ে নিন।`,
  restoreWorktree: (paths: readonly string[]) =>
    `${list(paths)} staging area-র অবস্থায় ফিরে গেল; commit না করা বদল মুছে গেল। সাবধান: আসল Git-এ এভাবে মোছা বদল আর ফেরত পাওয়া যায় না।`,
  restoreStaged: (paths: readonly string[]) =>
    `${list(paths)} staging area থেকে নামানো হলো (unstage)। ফাইলের লেখা বদলায়নি, শুধু পরের commit-এ আর যাবে না।`,
  restoreNothing: "ফেরানোর মতো কিছু নেই, সব আগে থেকেই মিলে আছে।",
  restoreResolved: (paths: readonly string[]) =>
    `${list(paths)}-এর conflict মিটল: staging area-তে শেষ commit-এর সংস্করণ বসল। ফাইলে এখনো conflict চিহ্নসহ লেখা আছে; চাইলে ঠিক করে \`git add\`।`,

  /* ---------- branch -d / -m ---------- */
  branchDeleteMissing: "কোন branch মুছবেন তার নাম দিন, যেমন `git branch -d feature`।",
  branchDeleted: (name: string, id: string) =>
    `branch ${name} মুছে গেল। তার commit-গুলো হারায়নি; সেগুলো অন্য branch-এ merge করা আছে। (শেষ commit ছিল ${id})`,
  branchForceDeleted: (name: string, id: string) =>
    `branch ${name} জোর করে মুছে গেল (-D)। এর যে commit অন্য কোনো branch-এ নেই, সেগুলো গ্রাফ থেকে লুকিয়ে গেল। (শেষ commit ছিল ${id})`,
  branchNotFound: (name: string) => `${name} নামে কোনো branch নেই। তালিকা দেখতে \`git branch\`।`,
  branchDeleteCurrent: (name: string) =>
    `আপনি এখন ${name}-এ আছেন, তাই এটাকে মোছা যাবে না। আগে অন্য branch-এ যান, যেমন \`git switch main\`।`,
  branchNotMerged: (name: string) =>
    `${name}-এর কিছু commit এখনো বর্তমান branch-এ merge হয়নি, মুছলে সেগুলো হারিয়ে যাবে। আগে \`git merge ${name}\` করুন, অথবা নিশ্চিত হলে \`git branch -D ${name}\`।`,
  branchRenameMissing: "নতুন নাম দিন, যেমন `git branch -m new-name` (বর্তমান branch) বা `git branch -m old new`।",
  branchRenamed: (from: string, to: string) => `branch ${from}-এর নাম বদলে ${to} হলো। commit-গুলো একই আছে।`,

  /* ---------- git rm ---------- */
  gitRmMissingArg: "কোন ফাইল মুছবেন তা বলুন, যেমন `git rm notes.txt`। ফাইল রেখে শুধু Git থেকে সরাতে `git rm --cached notes.txt`।",
  gitRmNoMatch: (path: string) =>
    `${path} Git চেনে না (untracked বা নেই)। \`git rm\` শুধু tracked ফাইলে চলে; untracked ফাইল মুছতে সাধারণ \`rm ${path}\`।`,
  gitRmNeedsRecursive: "সব ফাইল একসাথে মুছতে `-r` লাগে: `git rm -r .` (সাবধান, সব tracked ফাইল মুছে যাবে)।",
  gitRmBlocked: (paths: readonly string[], cachedOk: boolean) =>
    `${list(paths)}-এ এমন বদল আছে যা এখনো commit হয়নি; মুছলে সেটা হারিয়ে যেত, তাই Git থামল।` +
    (cachedOk ? ` ফাইল রেখে শুধু Git থেকে সরাতে \`git rm --cached ${paths[0]}\`।` : "") +
    ` নিশ্চিত হলে জোর করে মুছতে \`git rm -f ${paths[0]}\`।`,
  gitRmDone: (paths: readonly string[]) =>
    `${list(paths)} ফোল্ডার আর staging area দুই জায়গা থেকেই মুছে গেল, আর মুছে ফেলাটা staged। পরের commit-এ ফাইলটা আর থাকবে না। (\`rm\` আর \`git add\` একসাথে করার মতো।)`,
  gitRmCached: (paths: readonly string[], committed: boolean) =>
    `${list(paths)} staging area থেকে সরানো হলো, কিন্তু ফাইলটা ফোল্ডারে রয়ে গেল; Git এখন এটাকে untracked দেখছে।` +
    (committed ? " পরের commit-এ এটা repo থেকে মুছে যাবে, তবে আপনার ফোল্ডারে থাকবে।" : ""),
  gitRmResolved: (paths: readonly string[]) =>
    `${list(paths)}-এর conflict মুছে ফেলার মাধ্যমে মেটানো হলো: merge-এর পর ফাইলটা থাকবে না।`,

  /* ---------- commit --amend ---------- */
  amendNothing: "এখনো কোনো commit নেই, তাই বদলানোর (amend) মতো কিছু নেই। আগে একটা commit করুন।",
  amendInProgress: (kind: Exclude<Operation, "stash">) =>
    `${kind} চলাকালীন amend করা যায় না। আগে \`git commit\` দিয়ে ${kind} শেষ করুন, অথবা \`git ${kind} --abort\`।`,
  commitAmended: (oldId: string, newId: string, branch: string) =>
    `শেষ commit ${oldId}-এর জায়গায় নতুন commit ${newId} বসল, ${branch} এখন এটাকে দেখাচ্ছে। id বদলাল, কারণ Git-এ commit বদলানো যায় না, শুধু নতুন বানানো যায়। সাবধান: commit আগে push করা থাকলে amend করবেন না, অন্যদের ইতিহাসের সাথে মিলবে না।`,

  /* ---------- reset ---------- */
  resetSoft: (branch: string, id: string) =>
    `\`--soft\`: ${branch} সরে commit ${id}-এ গেল। ফাইল আর staging area একই আছে, তাই বাদ পড়া commit-গুলোর বদল এখন staged; চাইলে আবার একসাথে commit করতে পারেন।`,
  resetMixed: (branch: string, id: string) =>
    `${branch} সরে commit ${id}-এ গেল, আর staging area সেই commit-এর মতো হলো। ফাইলের লেখা বদলায়নি: বাদ পড়া commit-গুলোর বদল এখন unstaged হিসেবে ফোল্ডারে আছে।`,
  resetMixedHead: "staging area শেষ commit-এর মতো করা হলো, অর্থাৎ সব unstage হলো। ফাইলের লেখা বদলায়নি।",
  resetHard: (branch: string, id: string | null) =>
    id
      ? `\`--hard\`: ${branch}, staging area আর ফোল্ডারের tracked ফাইল সব commit ${id}-এর মতো হয়ে গেল। untracked ফাইল যেমন ছিল আছে।`
      : "`--hard`: staging area খালি হলো আর staged ফাইলগুলো ফোল্ডার থেকে মুছে গেল।",
  resetHardDiscarded: (paths: readonly string[]) =>
    `সাবধান: ${list(paths)}-এর commit না করা বদল মুছে গেল। আসল Git-এ এগুলো আর ফেরত পাওয়া যায় না (এখানে ↶ undo আছে)।`,
  resetLeftBehind: (oldId: string) =>
    `আগের commit ${oldId} মুছে যায়নি, শুধু এখন কোনো branch থেকে দেখা যায় না। ফিরতে চাইলে \`git reset --hard ${oldId}\`। (আসল Git-এ \`git reflog\` দিয়ে এমন id খুঁজে পাওয়া যায়।)`,
  resetMergeCleared: (kind: Operation) =>
    kind === "stash" ? "stash ফেরানোর conflict-ও মুছে গেল (stash-এর তালিকায় সেটা এখনো আছে)।" : `চলমান ${kind}-ও বাতিল হলো।`,
  resetNothing: "সব আগে থেকেই ওই অবস্থায় আছে, কিছু বদলায়নি।",
  resetPaths: (paths: readonly string[]) =>
    `${list(paths)} staging area থেকে নামানো হলো (unstage), \`git restore --staged\`-এর মতো। ফাইলের লেখা বদলায়নি।`,
  resetPathsTo: (paths: readonly string[], id: string) =>
    `staging area-তে ${list(paths)} commit ${id}-এর অবস্থায় গেল। ফোল্ডারের ফাইল বদলায়নি।`,
  resetUnknown: (arg: string) =>
    `"${arg}" কোনো commit বা ফাইল নয়। commit বোঝাতে লিখুন যেমন \`HEAD~1\` (এক commit আগে), branch-এর নাম বা commit id (\`git log --oneline\`-এ দেখা যায়)।`,
  resetModeWithPaths: (mode: string) =>
    `\`--${mode}\` পুরো branch সরায়, নির্দিষ্ট ফাইলের সাথে চলে না। একটা ফাইল unstage করতে \`git reset <file>\`, ফাইলের বদল বাদ দিতে \`git restore <file>\`।`,
  resetSoftMerge: "merge চলাকালীন `--soft` reset চলে না। merge বাতিল করতে `git merge --abort` বা `git reset --hard`।",

  /* ---------- revert ---------- */
  revertDone: (target: string, id: string) =>
    `commit ${target}-এর বদল উল্টে নতুন commit ${id} তৈরি হলো। পুরোনো commit ইতিহাসে থেকেই গেল; তাই push করা commit ফেরাতে reset নয়, revert নিরাপদ।`,
  revertConflict: (id: string, paths: readonly string[]) =>
    `commit ${id} উল্টাতে গিয়ে ${list(paths)}-এ conflict হলো, কারণ পরে ওই জায়গাগুলো আবার বদলানো হয়েছে। ফাইল ঠিক করে \`git add\`, তারপর \`git revert --continue\`। বাতিল করতে \`git revert --abort\`।`,
  revertNothing: (id: string) => `commit ${id} উল্টালেও কিছু বদলায় না (সম্ভবত আগেই উল্টানো হয়েছে), তাই নতুন commit হলো না।`,
  revertNotInProgress: "এখন কোনো revert চলছে না।",
  revertAborted: "revert বাতিল হলো। সব ফাইল revert শুরুর আগের অবস্থায় ফিরে গেল।",
  revertSkipped: "এই commit উল্টানো বাদ দেওয়া হলো; ফাইলগুলো আগের অবস্থায় ফিরে গেল।",
  revertBusy: (kind: Operation) =>
    kind === "merge"
      ? "merge এখনো শেষ হয়নি। আগে `git commit` দিয়ে merge শেষ করুন, অথবা `git merge --abort`।"
      : kind === "stash"
        ? "stash ফেরানোর conflict এখনো মেটানো হয়নি। আগে ফাইল ঠিক করে `git add` দিন।"
        : "আগের revert এখনো শেষ হয়নি। আগে `git revert --continue` বা `git revert --abort` দিন।",
  revertMissingArg: "কোন commit উল্টাবেন তা বলুন, যেমন `git revert HEAD` (শেষ commit) বা `git revert <commit-id>`।",
  revertTooMany: "সিমুলেটরে একবারে একটা commit-ই revert করা যায়।",
  revertBadRevision: (rev: string) =>
    `"${rev}" নামে কোনো commit পাওয়া গেল না। \`git log --oneline\` দিয়ে id দেখুন, অথবা \`HEAD\`, \`HEAD~1\` লিখুন।`,
  revertMergeCommit: (id: string) =>
    `${id} একটা merge commit, এর দুটো parent। কোন দিকে ফিরবেন বলতে আসল Git-এ \`-m 1\` দিতে হয়; সিমুলেটরে এটা এখনো নেই।`,
  revertDirtyIndex: "staging area-তে commit না করা বদল আছে, revert করলে সেগুলোর সাথে মিশে যেত। আগে commit করুন, অথবা `git stash`।",

  /* ---------- stash ---------- */
  stashSaved: (paths: readonly string[]) =>
    `${list(paths)}-এর commit না করা বদল stash-এ সরিয়ে রাখা হলো, ফোল্ডার এখন শেষ commit-এর মতো পরিষ্কার। ফিরিয়ে আনতে \`git stash pop\`। (untracked ফাইল stash-এ যায় না।)`,
  stashNothing: "সরিয়ে রাখার মতো কোনো বদল নেই। (untracked ফাইল stash-এ যায় না; আগে `git add` করতে হয়।)",
  stashNoCommit: "প্রথম commit-এর আগে stash করা যায় না, কারণ ফেরার মতো কোনো commit নেই। আগে একটা commit করুন।",
  stashUnmerged: "conflict মেটানো বাকি থাকলে stash করা যায় না। আগে ফাইল ঠিক করে `git add` দিন।",
  stashDuringMerge: "merge বা revert চলাকালীন stash সিমুলেটরে নেই। আগে সেটা শেষ বা বাতিল করুন।",
  stashMissingMessage: "`-m`-এর পরে মেসেজ দিন, যেমন `git stash -m \"অর্ধেক কাজ\"`।",
  stashList: (count: number) => `stash-এ মোট ${bn(count)}টা অবস্থা রাখা আছে; stash@{০} সবচেয়ে নতুন।`,
  stashListEmpty: "stash খালি।",
  stashEmpty: "stash খালি, ফিরিয়ে আনার মতো কিছু নেই। আগে `git stash` দিয়ে কিছু সরিয়ে রাখুন।",
  stashBadRef: (ref: string) => `"${ref}" নামে কোনো stash নেই। তালিকা দেখতে \`git stash list\`।`,
  stashApplied: (i: number) =>
    `stash@{${bn(i)}}-এর বদল ফোল্ডারে ফিরে এলো, তবে stash-এ এখনো রাখা আছে (মুছতে \`git stash drop\`)। আগে staged থাকা বদল এখন unstaged; শুধু নতুন যোগ করা ফাইল আবার staged।`,
  stashPopped: (i: number) =>
    `stash@{${bn(i)}}-এর বদল ফোল্ডারে ফিরে এলো আর stash থেকে মুছে গেল। আগে staged থাকা বদল এখন unstaged; শুধু নতুন যোগ করা ফাইল আবার staged।`,
  stashDropped: (i: number) => `stash@{${bn(i)}} মুছে গেল। সাবধান: আসল Git-এ মোছা stash ফেরত পাওয়া কঠিন।`,
  stashCleared: "stash-এর সব অবস্থা মুছে গেল।",
  stashBlocked: (paths: readonly string[]) =>
    `stash ফেরানো আটকে গেল: ${list(paths)}-এ এখন commit না করা বদল আছে, ফেরালে সেগুলো মুছে যেত। আগে commit করুন, বা আবার \`git stash\` দিন। stash যেমন ছিল আছে।`,
  stashConflict: (paths: readonly string[], i: number, pop: boolean) =>
    `stash@{${bn(i)}}-এর বদল ${list(paths)}-এ এখনকার লেখার সাথে একই জায়গায় পড়েছে (conflict)। ফাইলে চিহ্ন বসেছে: <<<<<<< Updated upstream-এর নিচে এখনকার লেখা, ======= এর পরে stash-এর লেখা। ঠিক করে \`git add ${paths[0]}\` দিন। অন্য বদলগুলো staged হয়ে আছে।${pop ? " conflict হয়েছে বলে stash মুছে যায়নি; কাজ শেষে \`git stash drop\`।" : ""}`,

  /* ---------- rm (সহায়ক) ---------- */
  rmMissingArg: "কোন ফাইল মুছবেন তার নাম দিন, যেমন `rm notes.txt`।",
  rmMissing: (name: string) => `${name} নামে কোনো ফাইল নেই।`,
  rmDone: (paths: readonly string[], tracked: boolean) =>
    tracked
      ? `${list(paths)} ফোল্ডার থেকে মুছে গেল। Git দেখছে ফাইলটা নেই (deleted); commit-এ নিতে \`git add ${paths[0]}\`।`
      : `${list(paths)} ফোল্ডার থেকে মুছে গেল।`,

  /* ---------- আগের ধাপে ফেরা ---------- */
  undoDone: (command: string) => `↶ আগের ধাপে ফেরা হলো। \`${command}\`-এর আগের অবস্থায় আছেন। (এটা সিমুলেটরের সুবিধা; আসল Git-এ এমন এক-ক্লিক undo নেই।)`,

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
  pwdShown: "এটা আপনার প্রজেক্ট ফোল্ডার। সিমুলেটরে ফোল্ডার একটাই, তাই সব কমান্ড এখানেই চলে।",
  echoShown: "echo শুধু লেখাটা দেখায়। ফাইলে লিখতে `echo \"লেখা\" > file` (বদলে দেয়) বা `>> file` (শেষে যোগ করে)।",
  echoMissingFile: "`>` বা `>>`-এর পরে ফাইলের নাম দিন, যেমন `echo \"hello\" >> notes.txt`।",
  echoAppended: (name: string, tracked: boolean) =>
    tracked
      ? `${name}-এর শেষে নতুন লাইন যোগ হলো। Git দেখছে ফাইলটা বদলেছে (modified); commit-এ নিতে আগে \`git add ${name}\`।`
      : `${name}-এর শেষে নতুন লাইন যোগ হলো। ফাইলটা এখনো untracked।`,
  helpShown: "যেকোনো কমান্ড লিখে Enter চাপুন। ↑/↓ দিয়ে আগের কমান্ড ফিরিয়ে আনা যায়। কমান্ড, ফাইল বা branch-এর নাম অর্ধেক লিখে Tab চাপলে বাকিটা বসে যায়; দুইবার Tab দিলে সব মিল দেখায়।",

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
  ['git commit [-a] -m "message"', "staged ফাইলগুলো নিয়ে নতুন commit বানায় (-a: বদলানো tracked ফাইল নিজে stage করে)"],
  ["git log [--oneline] [--graph] [--all] [-n N]", "commit-এর ইতিহাস দেখায় (--graph: রেখায় শাখা)"],
  ["git show [<commit>]", "একটা commit আর তার বদল দেখায়"],
  ["git branch [<name>]", "branch-এর তালিকা দেখায় / নতুন branch বানায়"],
  ["git switch [-c] <name>", "অন্য branch-এ যায় (-c দিলে নতুন বানিয়ে)"],
  ["git checkout [-b] <name>", "switch-এর পুরোনো রূপ (-b দিলে নতুন বানিয়ে)"],
  ["git merge <branch>", "অন্য branch-এর কাজ বর্তমান branch-এ আনে"],
  ["git merge --abort", "conflict-এ থেমে থাকা merge বাতিল করে"],
  ["git diff [--staged]", "কোন লাইন বদলেছে দেখায় (staged নয় / staged)"],
  ["git restore [--staged] <file>", "ফাইলের বদল বাদ দেয় / staging থেকে নামায়"],
  ["git branch -d|-D <name>", "branch মোছে (-D জোর করে)"],
  ["git branch -m [<old>] <new>", "branch-এর নাম বদলায়"],
  ['git commit --amend [-m "message"]', "শেষ commit বদলে নতুন commit বসায়"],
  ["git reset [--soft|--hard] [<commit>]", "branch পেছনে সরায় (ডিফল্ট: staging-ও; --soft: শুধু branch; --hard: ফাইলও)"],
  ["git reset <file>", "ফাইল staging থেকে নামায়"],
  ["git revert <commit>", "commit-এর বদল উল্টে নতুন commit বানায়"],
  ["git stash [-m <msg>]", "commit না করা বদল সরিয়ে রাখে"],
  ["git stash list|pop|apply|drop", "সরিয়ে রাখা বদল দেখায় / ফেরায় / মোছে"],
  ["git rm [--cached] <file>", "ফাইল মোছে আর মুছে ফেলাটা stage করে (--cached: ফাইল রেখে শুধু Git থেকে সরায়)"],
  ["touch <file>", "খালি নতুন ফাইল বানায়"],
  ['edit <file> "লেখা"', "ফাইলের লেখা বদলায় (না থাকলে বানায়)"],
  ["ls", "ফাইলের তালিকা দেখায়"],
  ["cat <file>", "ফাইলের লেখা দেখায়"],
  ["rm <file>", "ফোল্ডার থেকে ফাইল মোছে"],
  ['echo "লেখা" [>|>> <file>]', "লেখা দেখায় / ফাইলে লেখে (>> শেষে যোগ করে)"],
  ["pwd", "কোন ফোল্ডারে আছেন দেখায়"],
  ["help", "এই তালিকা দেখায়"],
  ["clear", "টার্মিনাল পরিষ্কার করে (ফাইল বা commit মোছে না)"],
];
