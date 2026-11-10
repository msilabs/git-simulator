/**
 * কমান্ডের তালিকা (registry)।
 * নতুন কমান্ড যোগ করতে: এই ফোল্ডারে নতুন ফাইল বানিয়ে একটা CommandHandler export করুন,
 * তারপর নিচের কোনো একটা তালিকায় নাম দিয়ে বসিয়ে দিন। repo.ts-এ কিছু বদলাতে হবে না।
 */
import type { CommandHandler } from "../types";
import { init } from "./init";
import { status } from "./status";
import { add } from "./add";
import { commit } from "./commit";
import { log } from "./log";
import { branch } from "./branch";
import { switchCmd, checkout } from "./switch";
import { merge } from "./merge";
import { diff } from "./diff";
import { restore } from "./restore";
import { rm } from "./rm";
import { gitRm } from "./gitRm";
import { reset } from "./reset";
import { revert } from "./revert";
import { stash } from "./stash";
import { show } from "./show";
import { echo } from "./echo";
import { pwd } from "./pwd";
import { touch } from "./touch";
import { edit } from "./edit";
import { ls } from "./ls";
import { cat } from "./cat";
import { help } from "./help";
import { clear } from "./clear";

export interface GitCommand {
  readonly run: CommandHandler;
  /** true হলে `git init`-এর আগে চালানো যায়। */
  readonly worksWithoutRepo?: boolean;
}

/** `git <name> ...` */
export const GIT_COMMANDS: Readonly<Record<string, GitCommand>> = {
  init: { run: init, worksWithoutRepo: true },
  status: { run: status },
  add: { run: add },
  commit: { run: commit },
  log: { run: log },
  branch: { run: branch },
  switch: { run: switchCmd },
  checkout: { run: checkout },
  merge: { run: merge },
  diff: { run: diff },
  restore: { run: restore },
  rm: { run: gitRm },
  reset: { run: reset },
  revert: { run: revert },
  stash: { run: stash },
  show: { run: show },
};

/** সিমুলেটরের সহায়ক কমান্ড (Git নয়) */
export const SHELL_COMMANDS: Readonly<Record<string, CommandHandler>> = {
  touch,
  edit,
  ls,
  cat,
  rm,
  help,
  clear,
  echo,
  pwd,
};
