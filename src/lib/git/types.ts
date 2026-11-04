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

export interface Repo {
  readonly commits: Readonly<Record<string, Commit>>;
  /** branch-এর নাম → commit id। প্রথম commit-এর আগে এটা খালি থাকে ("unborn" branch)। */
  readonly branches: Readonly<Record<string, string>>;
  /** HEAD সবসময় একটা branch-এর নাম (v1-এ detached HEAD নেই)। */
  readonly head: string;
  /** staging area (index)। আসল Git-এর মতো এতে সব tracked ফাইল থাকে। */
  readonly index: FileMap;
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
