/**
 * কমান্ডগুলোর সাধারণ হেল্পার। বড় অংশগুলো আলাদা ফাইলে আছে:
 * own.ts (নাম দিয়ে নিরাপদে খোঁজা), lines.ts (লাইন-diff), tree.ts (ফাইলের স্ন্যাপশট), refs.ts (commit/branch)।
 * কমান্ডের সুবিধার জন্য এখান থেকেই সব re-export করা হয়।
 */
import type { SimState, CommandResult } from "./types";

export * from "./own";
export * from "./lines";
export * from "./tree";
export * from "./refs";

/** সিমুলেটরের নকল প্রজেক্ট ফোল্ডার (git init-এর আউটপুটে দেখায়)। */
export const PROJECT_PATH = "/home/learner/project";

export function success(state: SimState, output: string, explanation: string): CommandResult {
  return { state, output, explanation, ok: true };
}

export function failure(state: SimState, output: string, explanation: string): CommandResult {
  return { state, output, explanation, ok: false };
}

/** conflict মেটানো বাকি থাকলে merge/commit-এর আসল Git এরর */
export const UNMERGED_ERROR = (verb: "Merging" | "Committing") =>
  `error: ${verb} is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.`;
