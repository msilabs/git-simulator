import type { CommandHandler } from "../types";
import { PROJECT_PATH, success } from "../helpers";
import { msg } from "../messages";

/** `pwd` (সহায়ক কমান্ড): এখন কোন ফোল্ডারে আছেন। সিমুলেটরে ফোল্ডার একটাই। */
export const pwd: CommandHandler = (state) => success(state, PROJECT_PATH, msg.pwdShown);
