import type { CommandHandler } from "../types";
import { success } from "../helpers";
import { HELP_ENTRIES, msg } from "../messages";

/** `help` (সহায়ক কমান্ড): সমর্থিত সব কমান্ড, বাংলায় এক লাইনের ব্যাখ্যাসহ। */
export const help: CommandHandler = (state) => {
  const width = Math.max(...HELP_ENTRIES.map(([cmd]) => cmd.length));
  const output = HELP_ENTRIES.map(([cmd, text]) => `  ${cmd.padEnd(width)}   ${text}`).join("\n");
  return success(state, output, msg.helpShown);
};
