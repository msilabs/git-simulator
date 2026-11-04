# Git Learning Simulator

A browser-based playground for learning Git without fear. Type Git commands into a fake terminal, watch the commit graph and file states update instantly, and read a short explanation in Bengali after every command.

No real Git runs here. A small, pure TypeScript model of Git lives in `src/lib/git/`. There is no server, database or login, and your progress is saved in your browser's `localStorage`.

![Screenshot of the simulator after a branch and merge](docs/screenshot.png)

## Supported commands

| Command | What it does |
|---|---|
| `git init` | Create a repository (re-running it prints "Reinitialized...") |
| `git status` | Show the branch plus staged, modified and untracked files |
| `git add <file>...` / `git add .` | Stage files |
| `git commit -m "message"` | Create a commit from the staging area |
| `git log` / `git log --oneline` | Show history reachable from the current branch |
| `git branch` / `git branch <name>` | List branches / create a branch at the current commit |
| `git switch <name>` / `git switch -c <name>` | Switch branches / create and switch |
| `git checkout <name>` / `git checkout -b <name>` | Same as above, using the older command |
| `git merge <branch>` | Fast-forward, or create a two-parent merge commit |

Simulator-only helpers: `touch <file>`, `edit <file> "text"` (use `\n` for new lines), `ls`, `cat <file>`, `help`, `clear`.

Other Git commands are recognised as "not in the simulator yet".

### Where the model is simpler than real Git

- Commit ids are 7-character hex ids from a small hash, not SHA-1. They are unique within a session.
- There are no folders. File names are flat, and there are no globs.
- Merges compare whole files. If both sides changed the same file, the merge is aborted, with nothing changed (conflict resolution is planned). Real Git would merge non-overlapping line changes.
- The merge base is the newest common ancestor. Real Git also handles multiple merge bases.
- `git log` shows no `Date` line, uses a fixed author and does not open a pager.
- `git commit` without `-m` asks for a message instead of opening an editor.
- Line counts in `insertions(+)/deletions(-)` ignore whether a file ends with a newline.
- There is no detached HEAD, and `git checkout <file>` is not supported.

Like real Git, `switch`/`checkout` carry uncommitted changes along when the file is identical on both branches. They refuse only when your changes would be overwritten.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest
npm run build    # static production build
```

The site is fully static and deploys to Vercel as-is.

## Project layout

```
src/lib/git/
  types.ts        Repo, Commit, SimState, CommandResult types
  repo.ts         runCommand(state, input) => { state, output, explanation, ok }
  parser.ts       splits terminal input into words (handles quotes)
  messages.ts     every Bengali explanation and error in one place
  helpers.ts      shared pure helpers (trees, diffs, ids, ancestry)
  commands/       one file per command + index.ts registry
src/lib/graph/    pure layout for the SVG commit graph
src/components/   Terminal, FilePanel, CommitGraph, Simulator
tests/            Vitest tests for every command
```

State is immutable: every command returns a new `SimState`, so features like undo can be added by keeping old states around.

## Adding a new command

1. Create `src/lib/git/commands/<name>.ts` and export a `CommandHandler`:
   `(state, args) => CommandResult`. Never mutate `state`; return a new object.
2. Put all Bengali text in `src/lib/git/messages.ts`.
3. Register it in `src/lib/git/commands/index.ts` (`GIT_COMMANDS` for `git <name>`, `SHELL_COMMANDS` for helpers) and add a line to `HELP_ENTRIES`.
4. Add `tests/<name>.test.ts`. When unsure, match real Git's behaviour and output. If you simplify, say so in a code comment.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## বাংলায় সংক্ষেপে

**Git শেখার সিমুলেটর** হলো নতুন ডেভেলপারদের জন্য একটা ফ্রি, ওপেন-সোর্স অনুশীলনের জায়গা। ব্রাউজারের নকল টার্মিনালে Git কমান্ড লিখুন। পাশে commit গ্রাফ আর ফাইলের অবস্থা সাথে সাথে বদলাবে, আর প্রতিটা কমান্ডের পর বাংলায় ছোট ব্যাখ্যা আসবে: কী ঘটল আর কেন। এখানে আসল Git চলে না, তাই ভুল করলেও কিছু নষ্ট হবে না। ওপরের "নতুন করে শুরু" বোতাম চাপলেই আবার প্রথম থেকে শুরু করা যায়।

শুরু করতে লিখুন `git init`, তারপর টার্মিনালের নিচের "প্রথম ৫টা কমান্ড" ধাপগুলো অনুসরণ করুন।

## License

[MIT](LICENSE) © msilabs
