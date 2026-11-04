"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runCommand, EMPTY_STATE } from "@/lib/git/repo";
import { tokenize } from "@/lib/git/parser";
import { msg } from "@/lib/git/messages";
import type { SimState } from "@/lib/git/types";
import { clearSession, loadSession, saveSession, type TerminalLine } from "@/lib/storage";
import { Terminal } from "./Terminal";
import { FilePanel } from "./FilePanel";
import { CommitGraph } from "./CommitGraph";

/** শুরুর "প্রথম ৫টা কমান্ড" */
export const STARTER_STEPS = [
  "git init",
  "touch index.html",
  "git add index.html",
  'git commit -m "first commit"',
  "git log",
] as const;

const sameCommand = (a: string, b: string) => tokenize(a).tokens.join("\u0001") === tokenize(b).tokens.join("\u0001");

const welcomeLines = (): TerminalLine[] => [{ id: 1, kind: "welcome", text: msg.welcome }];

interface Session {
  sim: SimState;
  lines: TerminalLine[];
  history: string[];
  step: number;
}

const freshSession = (): Session => ({ sim: EMPTY_STATE, lines: welcomeLines(), history: [], step: 0 });

export function Simulator() {
  const [session, setSession] = useState<Session>(freshSession);
  const [loaded, setLoaded] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const nextId = useRef(2);

  // প্রথমবার: সেভ করা অবস্থা ফিরিয়ে আনা (সার্ভারে localStorage নেই, তাই useEffect-এ)
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      nextId.current = Math.max(1, ...saved.lines.map((l) => l.id)) + 1;
      setSession({ sim: saved.sim, lines: saved.lines, history: saved.history, step: saved.step ?? 0 });
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveSession({ v: 1, ...session });
  }, [session, loaded]);

  const prompt = useMemo(
    () => `~/project${session.sim.repo ? ` (${session.sim.repo.head})` : ""} $`,
    [session.sim.repo],
  );

  const run = useCallback(
    (command: string) => {
      setSession((s) => {
        const id = () => nextId.current++;
        const promptNow = `~/project${s.sim.repo ? ` (${s.sim.repo.head})` : ""} $`;
        const input: TerminalLine = { id: id(), kind: "input", text: command, prompt: promptNow };
        if (!command.trim()) return { ...s, lines: [...s.lines, input] };

        const result = runCommand(s.sim, command);
        const history = s.history[s.history.length - 1] === command ? s.history : [...s.history, command];
        if (result.clearScreen) return { ...s, sim: result.state, lines: [], history };

        const lines = [...s.lines, input];
        if (result.output) lines.push({ id: id(), kind: result.ok ? "output" : "error", text: result.output });
        if (result.explanation) {
          lines.push({ id: id(), kind: result.ok ? "explain" : "explain-error", text: result.explanation });
        }

        let step = s.step;
        if (result.ok && step < STARTER_STEPS.length && sameCommand(command, STARTER_STEPS[step])) {
          step++;
          if (step === STARTER_STEPS.length) lines.push({ id: id(), kind: "welcome", text: msg.stepsDone });
        }
        return { sim: result.state, lines, history, step };
      });
    },
    [],
  );

  const reset = () => {
    clearSession();
    nextId.current = 2;
    setSession({ ...freshSession(), lines: [{ id: 1, kind: "welcome", text: msg.resetDone }] });
    setConfirmReset(false);
  };

  const steps = STARTER_STEPS.map((command, i) => ({ command, done: i < session.step }));

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink font-mono text-lg font-bold text-mint" aria-hidden>
              m
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-ink sm:text-lg">Git শেখার সিমুলেটর</h1>
              <p className="hidden text-xs text-slate sm:block">ভয় না পেয়ে Git চর্চা করুন। এখানে কিছুই নষ্ট হবে না।</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => run("help")}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-teal ring-1 ring-teal/30 transition hover:bg-teal/5"
            >
              help
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink-3"
            >
              নতুন করে শুরু
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        {/* মোবাইলে ক্রম: গ্রাফ → ফাইল → টার্মিনাল */}
        <div className="h-[330px] lg:col-start-1 lg:row-start-2 lg:h-auto lg:min-h-0">
          <CommitGraph repo={session.sim.repo} />
        </div>
        <div className="lg:col-start-1 lg:row-start-1">
          <FilePanel state={session.sim} />
        </div>
        <div className="h-[70dvh] min-h-[380px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:min-h-0">
          <Terminal lines={session.lines} history={session.history} prompt={prompt} steps={steps} onRun={run} />
        </div>
      </main>

      <footer className="py-3 text-center text-xs text-slate">msilabs · Free &amp; open source</footer>

      {confirmReset && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-ink/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          onKeyDown={(e) => e.key === "Escape" && setConfirmReset(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="reset-title" className="text-lg font-bold text-ink">
              নতুন করে শুরু করবেন?
            </h2>
            <p className="mt-2 text-sm text-slate">
              সব ফাইল, commit, branch আর টার্মিনালের লেখা মুছে যাবে। এটা আর ফেরানো যাবে না।
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmReset(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-ink ring-1 ring-ink/20 hover:bg-cloud"
              >
                না, থাক
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
              >
                হ্যাঁ, সব মুছুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
