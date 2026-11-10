/**
 * সিমুলেটরের মূল প্রবেশপথ: (state, লেখা কমান্ড) => { state, output, explanation }
 * এটা pure function: পুরোনো state কখনো বদলায় না, React-এর ওপর নির্ভর করে না।
 */
import type { CommandResult, SimState } from "./types";
import { EMPTY_STATE } from "./types";
import { parseCommand } from "./parser";
import { failure, get } from "./helpers";
import { msg } from "./messages";
import { GIT_COMMANDS, SHELL_COMMANDS } from "./commands";

export function runCommand(state: SimState, input: string): CommandResult {
  const parsed = parseCommand(input);
  if (!parsed.ok) {
    if (parsed.error === "empty") return { state, output: "", explanation: "", ok: true };
    return failure(state, "error: unterminated quoted string", msg.unclosedQuote);
  }
  const { program, args } = parsed;

  if (program === "git") {
    const [sub, ...rest] = args;
    if (!sub) return failure(state, "usage: git <command> [<args>]", msg.gitAlone);
    const command = get(GIT_COMMANDS, sub);
    if (!command) {
      return failure(
        state,
        `git: '${sub}' is not supported in this simulator yet.`,
        msg.unsupportedGit,
      );
    }
    if (!state.repo && !command.worksWithoutRepo) {
      return failure(
        state,
        "fatal: not a git repository (or any of the parent directories): .git",
        msg.notARepo,
      );
    }
    return command.run(state, rest);
  }

  const shell = get(SHELL_COMMANDS, program);
  if (shell) return shell(state, args);
  return failure(state, `${program}: command not found`, msg.unknownCommand);
}

/** কয়েকটা কমান্ড পরপর চালায়: টেস্ট আর ডেমোর জন্য সুবিধাজনক। */
export function runAll(inputs: readonly string[], start: SimState = EMPTY_STATE): SimState {
  return inputs.reduce((s, line) => runCommand(s, line).state, start);
}

export { EMPTY_STATE };
