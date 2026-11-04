# Contributing

Thanks for helping new developers learn Git! Contributions of every size are welcome: Bengali wording fixes, bug reports, tests and new commands.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Issues and pull requests may be written in Bengali or English.

## Setup

```bash
npm install
npm run dev        # dev server at http://localhost:3000
npm test           # run all Vitest tests once
npm run test:watch # re-run tests on change
npm run lint
npm run build      # must pass before a PR
```

## Code style

- TypeScript strict mode, formatted like the existing code (2 spaces, double quotes, trailing commas).
- `src/lib/git` must stay free of React and browser APIs. Every command is a pure function.
- Never mutate state. Return new objects with spread (`{ ...state, repo: { ...repo, index } }`).
- Terminal output is English and mirrors real Git as closely as practical. Explanations are Bengali and live only in `messages.ts`.
- Bengali text should be short, friendly and plain. Write numbers with Bengali digits (use `bn()`).
- When the simulator deliberately differs from real Git, leave a comment starting with `সরলীকরণ:` ("simplification") explaining how.
- Brand colors: Mint `#1ED6A8`, Ink Navy `#14213D`, Deep Teal `#0B7F6E`, Sun `#FFB020`, Indigo `#4F46E5`, Slate `#5B6782`, Cloud `#F5F7FB`. Do not use Mint or Sun as text color on white.

## Adding a command, step by step

1. **Check real Git.** Run the command in a scratch repo and note the exact output, including error cases.
2. **Write the handler** in `src/lib/git/commands/<name>.ts`:
   ```ts
   import type { CommandHandler } from "../types";
   import { failure, success } from "../helpers";
   import { msg } from "../messages";

   export const myCommand: CommandHandler = (state, args) => {
     // ...validate args, return failure(state, "fatal: ...", msg.something)
     return success(newState, "output like real git", msg.somethingDone);
   };
   ```
3. **Add messages** to `messages.ts`.
4. **Register** the handler in `commands/index.ts` and add a line to `HELP_ENTRIES`.
5. **Test** it in `tests/<name>.test.ts`: the normal case, every error case, and that the previous state is not mutated. Use the `exec`/`state` helpers in `tests/setup.ts`.
6. Run `npm test && npm run lint && npm run build`.

## Commits and pull requests

- Small, focused commits with conventional prefixes, e.g. `feat: add git restore`, `fix: status for deleted files`, `docs: ...`.
- Describe what changed and how you tested it in the PR (the PR template has a checklist).
- Add a line to `CHANGELOG.md` under an "Unreleased" heading.
