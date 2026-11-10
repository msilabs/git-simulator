/**
 * Git সিমুলেটরের সরল ডেটা মডেল।
 *
 * সব অবজেক্ট immutable হিসেবে ব্যবহার করা হয়: কোনো কমান্ড পুরোনো state
 * বদলায় না, বরং নতুন state ফেরত দেয়। তাই পরে "আগের ধাপে ফেরা" (undo)
 * যোগ করতে চাইলে শুধু পুরোনো state-গুলো জমিয়ে রাখলেই হবে।
 */

/** ফাইলের নাম → ফাইলের লেখা */
export type FileMap = Readonly<Record<string, string>>;

export interface Commit {
  /** ৭ অক্ষরের hex id। আসল SHA-1 নয়, তবে একই সেশনে অনন্য। */
  readonly id: string;
  readonly message: string;
  /** ০টা (প্রথম commit), ১টা (সাধারণ) বা ২টা (merge commit) parent। */
  readonly parents: readonly string[];
  /** এই commit-এর সময়ের সব ফাইলের পূর্ণ স্ন্যাপশট। */
  readonly files: FileMap;
  /** ক্রমিক সময় (১, ২, ৩ ...)। আসল তারিখের বদলে শুধু ক্রম বোঝাতে। */
  readonly time: number;
  /**
   * কোন branch-এ থাকা অবস্থায় commit-টা বানানো হয়েছিল।
   * আসল Git এই তথ্য রাখে না; এটা শুধু গ্রাফে লেন ঠিক করার জন্য।
   */
  readonly branch: string;
}

/** conflict-এর ধরন, আসল `git status`-এর লেবেল অনুযায়ী */
export type ConflictKind = "both modified" | "both added" | "deleted by us" | "deleted by them";

/**
 * conflict-এর কারণে থেমে থাকা merge বা revert
 * (আসল Git-এ .git/MERGE_HEAD বা REVERT_HEAD, আর MERGE_MSG)।
 * সরলীকরণ: আসল Git index-এ unmerged ফাইলের তিনটা "stage" (base/ours/theirs) রাখে;
 * আমরা index-এ ours রেখে আলাদা তালিকায় চিহ্ন দিই কোনগুলো এখনো মেটানো হয়নি।
 */
export interface MergeState {
  /** "merge": `git merge` থেমে আছে; "revert": `git revert` থেমে আছে */
  readonly kind: "merge" | "revert";
  /** merge-এ: যে commit merge করা হচ্ছে (MERGE_HEAD); revert-এ: যে commit উল্টানো হচ্ছে (REVERT_HEAD) */
  readonly theirs: string;
  /** merge-এ: যে branch merge করা হচ্ছে; revert-এ: উল্টানো commit-এর id */
  readonly branch: string;
  /** commit-এর ডিফল্ট মেসেজ (MERGE_MSG) */
  readonly message: string;
  /** এখনো মেটানো হয়নি এমন ফাইল আর তাদের conflict-এর ধরন */
  readonly unmerged: Readonly<Record<string, ConflictKind>>;
  /** merge যে ফাইলগুলো বদলেছে; `merge --abort` এগুলোকে HEAD-এ ফেরায় */
  readonly touched: readonly string[];
}

/**
 * `git stash`-এ রাখা একটা অবস্থা।
 * সরলীকরণ: আসল Git এগুলো বিশেষ commit হিসেবে রাখে (refs/stash); আমরা আলাদা তালিকায় রাখি,
 * তাই গ্রাফে দেখা যায় না। untracked ফাইল stash-এ যায় না (আসল Git-এর ডিফল্টের মতো)।
 */
export interface StashEntry {
  readonly id: string;
  /** "WIP on main: abc1234 subject" বা "On main: নিজের মেসেজ" */
  readonly message: string;
  /** stash করার সময়ের HEAD commit */
  readonly base: string;
  /** stash করার সময়ের staging area */
  readonly index: FileMap;
  /** stash করার সময় tracked ফাইলগুলোর লেখা (index-এ আছে কিন্তু এখানে নেই মানে ফাইলটা মোছা ছিল) */
  readonly workdir: FileMap;
}

export interface Repo {
  readonly commits: Readonly<Record<string, Commit>>;
  /** branch-এর নাম → commit id। প্রথম commit-এর আগে এটা খালি থাকে ("unborn" branch)। */
  readonly branches: Readonly<Record<string, string>>;
  /** HEAD সবসময় একটা branch-এর নাম (v1-এ detached HEAD নেই)। */
  readonly head: string;
  /** staging area (index)। আসল Git-এর মতো এতে সব tracked ফাইল থাকে। */
  readonly index: FileMap;
  /** merge বা revert conflict-এ থেমে থাকলে থাকে; null মানে কিছু চলছে না। */
  readonly merge: MergeState | null;
  /** `git stash`-এর তালিকা, সবচেয়ে নতুনটা আগে (stash@{0}) */
  readonly stash: readonly StashEntry[];
}

export interface SimState {
  /** working directory: যে ফাইলগুলো "ডিস্কে" আছে। */
  readonly workdir: FileMap;
  /** `git init`-এর আগে null। */
  readonly repo: Repo | null;
  /** প্রতিটা commit-এ এক করে বাড়ে; commit-এর ক্রমিক সময় আর id বানাতে লাগে। */
  readonly clock: number;
}

export interface CommandResult {
  readonly state: SimState;
  /** আসল Git/শেলের মতো ইংরেজি আউটপুট (খালিও হতে পারে)। */
  readonly output: string;
  /** বাংলায় ছোট ব্যাখ্যা: কী ঘটল। */
  readonly explanation: string;
  /** কমান্ড সফল হয়েছে কি না (রঙ ঠিক করতে)। */
  readonly ok: boolean;
  /** true হলে টার্মিনাল পরিষ্কার করতে হবে (state বদলায় না)। */
  readonly clearScreen?: boolean;
}

/** প্রতিটা কমান্ডের handler একই আকারের pure function। */
export type CommandHandler = (state: SimState, args: readonly string[]) => CommandResult;

export const EMPTY_STATE: SimState = Object.freeze({
  workdir: Object.freeze({}),
  repo: null,
  clock: 0,
});
