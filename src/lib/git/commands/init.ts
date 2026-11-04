import type { CommandHandler } from "../types";
import { PROJECT_PATH, success } from "../helpers";
import { msg } from "../messages";

/**
 * `git init`
 * আগে থেকে ফোল্ডারে থাকা ফাইলগুলো রয়ে যায় আর untracked হিসেবে দেখায় (আসল Git-এর মতো)।
 * সরলীকরণ: `--bare`, `-b <name>` ইত্যাদি অপশন নেই; ডিফল্ট branch সবসময় main।
 */
export const init: CommandHandler = (state) => {
  if (state.repo) {
    return success(state, `Reinitialized existing Git repository in ${PROJECT_PATH}/.git/`, msg.reinit);
  }
  return success(
    { ...state, repo: { commits: {}, branches: {}, head: "main", index: {} } },
    `Initialized empty Git repository in ${PROJECT_PATH}/.git/`,
    msg.init,
  );
};
