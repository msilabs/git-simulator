import type { CommandHandler } from "../types";
import { success } from "../helpers";
import { msg } from "../messages";

/**
 * `ls` (সহায়ক কমান্ড)
 * সরলীকরণ: আসল ls `.git` ফোল্ডার লুকিয়ে রাখে; সিমুলেটরে ফোল্ডারই নেই, তাই শুধু ফাইল।
 */
export const ls: CommandHandler = (state) => {
  const names = Object.keys(state.workdir).sort();
  if (names.length === 0) return success(state, "", msg.lsEmpty);
  return success(state, names.join("  "), msg.lsShown(names.length));
};
