"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { TerminalLine } from "@/lib/storage";
import { RichText } from "./RichText";
import { OutputBlock } from "./OutputBlock";

export interface Step {
  readonly command: string;
  readonly done: boolean;
}

interface TerminalProps {
  lines: readonly TerminalLine[];
  history: readonly string[];
  prompt: string;
  steps: readonly Step[];
  onRun: (command: string) => void;
}

const lineClass: Record<TerminalLine["kind"], string> = {
  input: "text-white",
  output: "text-slate-200",
  error: "text-danger",
  explain: "font-sans text-mint",
  "explain-error": "font-sans text-sun",
  welcome: "font-sans text-white",
};

export function Terminal({ lines, history, prompt, steps, onRun }: TerminalProps) {
  const [value, setValue] = useState("");
  // history-তে কোথায় আছি; history.length মানে "নতুন লাইন"
  const [cursor, setCursor] = useState<number | null>(null);
  const draft = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const submit = (command: string) => {
    onRun(command);
    setValue("");
    setCursor(null);
    draft.current = "";
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(value);
    } else if (e.key === "ArrowUp") {
      if (history.length === 0) return;
      e.preventDefault();
      const cur = cursor ?? history.length;
      if (cursor === null) draft.current = value;
      const next = Math.max(0, cur - 1);
      setCursor(next);
      setValue(history[next]);
    } else if (e.key === "ArrowDown") {
      if (cursor === null) return;
      e.preventDefault();
      const next = cursor + 1;
      if (next >= history.length) {
        setCursor(null);
        setValue(draft.current);
      } else {
        setCursor(next);
        setValue(history[next]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      submit("clear");
    }
  };

  const nextStep = steps.findIndex((s) => !s.done);

  return (
    <section
      aria-label="টার্মিনাল"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-ink shadow-lg ring-1 ring-white/10"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-sun" aria-hidden />
        <span className="h-3 w-3 rounded-full bg-mint" aria-hidden />
        <h2 className="ml-2 text-sm font-semibold text-slate-200">টার্মিনাল</h2>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="terminal-scroll relative min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
        onClick={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
      >
        {lines.map((line) => (
          <div key={line.id} className={`whitespace-pre-wrap break-words [tab-size:4] ${lineClass[line.kind]}`}>
            {line.kind === "input" ? (
              <>
                <span className="text-mint">{line.prompt}</span> <span>{line.text}</span>
              </>
            ) : line.kind === "explain" || line.kind === "explain-error" ? (
              <div className="my-1 border-l-2 border-current pl-2 text-[14px]">
                <RichText text={line.text} />
              </div>
            ) : line.kind === "welcome" ? (
              <div className="mb-1 text-[15px]">
                <RichText text={line.text} codeClassName="rounded bg-mint/15 px-1 font-mono text-mint" />
              </div>
            ) : line.kind === "output" ? (
              <OutputBlock text={line.text} />
            ) : (
              line.text
            )}
          </div>
        ))}

        <label className="flex items-center gap-2">
          <span className="shrink-0 text-mint">{prompt}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setCursor(null);
            }}
            onKeyDown={onKeyDown}
            autoFocus
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            aria-label="কমান্ড লিখুন"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-white caret-sun outline-none sm:text-[13px]"
            placeholder={lines.length <= 2 ? "এখানে লিখুন…" : ""}
          />
        </label>
      </div>

      {nextStep !== -1 && (
        <div className="border-t border-white/10 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-300">প্রথম ৫টা কমান্ড (ক্লিক করলেই চলবে):</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, i) => (
              <li key={step.command} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    submit(step.command);
                    inputRef.current?.focus();
                  }}
                  className={`rounded-md px-2 py-1 font-mono text-xs transition ${
                    step.done
                      ? "bg-mint/15 text-mint"
                      : i === nextStep
                        ? "bg-sun text-ink ring-2 ring-sun/40 hover:brightness-105"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {step.done ? "✓ " : `${"১২৩৪৫"[i]}. `}
                  {step.command}
                </button>
                {i < steps.length - 1 && <span className="text-slate-500" aria-hidden>→</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
