"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { msg } from "@/lib/git/messages";
import { applyCommand, freshSession, promptFor, showCompletions, undo as undoSession, type Session } from "@/lib/session";
import { complete } from "@/lib/git/complete";
import { MISSIONS, missionAt } from "@/lib/missions";
import type { MissionView } from "./MissionPanel";
import { clearSession, loadSession, saveSession, watchSession } from "@/lib/storage";
import { ui } from "@/lib/ui-text";
import { Terminal } from "./Terminal";
import { FilePanel } from "./FilePanel";
import { CommitGraph } from "./CommitGraph";

const buttonOutline =
  "rounded-lg px-2.5 py-2 text-sm font-semibold text-teal ring-1 ring-teal/30 transition hover:bg-teal/5 sm:px-3";

export function Simulator() {
  const [session, setSession] = useState<Session>(() => freshSession());
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // অন্য tab থেকে আসা অবস্থা আবার সেভ করার দরকার নেই (সেটা আগেই সেভ করা)
  const fromOtherTab = useRef(false);

  // প্রথমবার: সেভ করা অবস্থা ফিরিয়ে আনা। localStorage একটা বাইরের সিস্টেম, আর সার্ভারে নেই;
  // hydration-এর আগে পড়লে সার্ভারের HTML আর প্রথম রেন্ডার মিলবে না, তাই effect-এ পড়ি।
  useEffect(() => {
    const result = loadSession();
    /* eslint-disable react-hooks/set-state-in-effect -- বাইরের স্টোরেজের সাথে একবার মেলানো */
    if (result.status === "ok") setSession(result.session);
    else if (result.status === "corrupt") {
      clearSession();
      setSession(freshSession(`${ui.loadFailed} ${msg.welcome}`));
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(
    () =>
      watchSession((result) => {
        if (result.status === "corrupt") return;
        fromOtherTab.current = true;
        setSession(result.status === "ok" ? result.session : freshSession(msg.resetDone));
      }),
    [],
  );

  useEffect(() => {
    if (!loaded) return;
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    setSaveFailed(!saveSession(session));
  }, [session, loaded]);

  const run = useCallback((command: string) => setSession((s) => applyCommand(s, command)), []);
  const undo = useCallback(() => setSession(undoSession), []);
  const listCompletions = useCallback(
    (text: string, candidates: readonly string[]) => setSession((s) => showCompletions(s, text, candidates)),
    [],
  );

  const reset = () => {
    clearSession();
    setSession(freshSession(msg.resetDone));
    setConfirmReset(false);
  };

  // মোডাল খোলা থাকলে Tab শুধু মোডালের বোতামগুলোর মধ্যেই ঘোরে
  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") setConfirmReset(false);
    if (e.key !== "Tab" || !dialogRef.current) return;
    const buttons = [...dialogRef.current.querySelectorAll("button")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const lastPast = session.past[session.past.length - 1];
  const at = missionAt(session.step);
  const current = MISSIONS[at.index];
  const mission: MissionView | null = current
    ? {
        number: at.index + 1,
        total: MISSIONS.length,
        title: current.title,
        goal: current.goal,
        stages: current.stages.map((s, i) => ({ label: s.label, done: i < at.done, command: s.command })),
        all: MISSIONS.map((m, i) => ({ title: m.title, done: i < at.index, current: i === at.index })),
      }
    : null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-ink/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-4 py-3 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink font-mono text-lg font-bold text-mint" aria-hidden>
              m
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight text-ink sm:text-lg">{ui.appTitle}</h1>
              <p className="hidden text-xs text-slate sm:block">{ui.tagline}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={!lastPast}
              title={lastPast ? ui.undoTitle(lastPast.command) : ui.undoNone}
              aria-label={ui.undoLabel}
              className={`${buttonOutline} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
            >
              ↶<span className="hidden sm:inline"> {ui.undo}</span>
            </button>
            <button type="button" onClick={() => run("help")} className={buttonOutline}>
              {ui.help}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              aria-label={ui.reset}
              title={ui.reset}
              className="rounded-lg bg-ink px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-ink-3 sm:px-3"
            >
              <span aria-hidden className="sm:hidden">
                ↺
              </span>
              <span className="hidden sm:inline">{ui.reset}</span>
            </button>
          </div>
        </div>
        {saveFailed && (
          <p role="status" className="border-t border-sun/40 bg-[#FFF6E5] px-4 py-1.5 text-center text-xs text-ink">
            ⚠ {ui.saveFailed}
          </p>
        )}
      </header>

      <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        {/* মোবাইলে ক্রম: গ্রাফ → ফাইল → টার্মিনাল */}
        <div className="h-[330px] min-w-0 lg:col-start-1 lg:row-start-2 lg:h-auto lg:min-h-0">
          <CommitGraph repo={session.sim.repo} />
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <FilePanel state={session.sim} onRun={run} />
        </div>
        <div className="h-[70dvh] min-h-[380px] min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-auto lg:min-h-0">
          <Terminal
            lines={session.lines}
            history={session.history}
            prompt={promptFor(session.sim)}
            mission={mission}
            onRun={run}
            complete={(text) => complete(session.sim, text)}
            onListCompletions={listCompletions}
          />
        </div>
      </main>

      <footer className="py-3 text-center text-xs text-slate">{ui.footer}</footer>

      {confirmReset && (
        <div
          className="fixed inset-0 z-30 grid place-items-center bg-ink/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          aria-describedby="reset-body"
          onKeyDown={trapFocus}
        >
          <div ref={dialogRef} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="reset-title" className="text-lg font-bold text-ink">
              {ui.resetTitle}
            </h2>
            <p id="reset-body" className="mt-2 text-sm text-slate">
              {ui.resetBody}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmReset(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-ink ring-1 ring-ink/20 hover:bg-cloud"
              >
                {ui.resetCancel}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
              >
                {ui.resetConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
