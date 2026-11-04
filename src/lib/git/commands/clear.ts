import type { CommandHandler } from "../types";

/** `clear` (সহায়ক কমান্ড): শুধু টার্মিনালের লেখা মোছে, ফাইল বা commit নয়। */
export const clear: CommandHandler = (state) => ({
  state,
  output: "",
  explanation: "",
  ok: true,
  clearScreen: true,
});
