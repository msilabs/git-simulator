"use client";

import { useState } from "react";
import { ui } from "@/lib/ui-text";
import { RichText } from "./RichText";

export interface MissionView {
  /** ১ থেকে শুরু */
  readonly number: number;
  readonly total: number;
  readonly title: string;
  readonly goal: string;
  readonly stages: readonly { readonly label: string; readonly done: boolean; readonly command?: string }[];
  readonly all: readonly { readonly title: string; readonly done: boolean; readonly current: boolean }[];
}

/**
 * টার্মিনালের নিচে বর্তমান মিশন: লক্ষ্য, ধাপগুলো (✓ দিয়ে), আর সব মিশনের তালিকা।
 * সব ধাপে কমান্ড থাকলে (প্রথম মিশন) ধাপগুলো বোতাম, চাপলে কমান্ড চলে।
 */
export function MissionPanel({ mission, onRun }: { mission: MissionView | null; onRun: (command: string) => void }) {
  const [hidden, setHidden] = useState(false);
  const list = mission?.all ?? [];

  const overview = (
    <details className="mt-2 text-xs text-slate-300">
      <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">{ui.missionAll}</summary>
      <ol className="mt-1.5 space-y-0.5">
        {list.map((m, i) => (
          <li key={m.title} className={m.current ? "font-semibold text-sun" : m.done ? "text-mint" : "text-slate-400"}>
            {m.done ? "✓" : ui.stepNumber(i)} {m.title}
          </li>
        ))}
      </ol>
    </details>
  );

  if (!mission) {
    return (
      <div className="border-t border-white/10 px-4 py-2 text-xs text-mint" data-testid="missions">
        ✓ {ui.missionsAllDone}
      </div>
    );
  }

  const current = mission.stages.findIndex((s) => !s.done);
  const buttons = mission.stages.every((s) => s.command);
  return (
    <div className="border-t border-white/10 px-4 py-3" data-testid="missions">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-200">
          {ui.missionHeading(mission.number, mission.total)} <span className="text-sun">{mission.title}</span>
        </p>
        <button
          type="button"
          onClick={() => setHidden(!hidden)}
          aria-expanded={!hidden}
          className="shrink-0 rounded px-1.5 text-[11px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
        >
          {hidden ? ui.missionShow : ui.missionHide}
        </button>
      </div>
      {!hidden && (
        <>
          <div className="mt-1 text-xs text-slate-300">
            <RichText text={mission.goal} />
          </div>
          {buttons ? (
            <ol className="mt-2 flex flex-wrap items-center gap-1.5">
              {mission.stages.map((stage, i) => (
                <li key={stage.label} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRun(stage.command!)}
                    className={`rounded-md px-2 py-1 font-mono text-xs transition ${
                      stage.done
                        ? "bg-mint/15 text-mint"
                        : i === current
                          ? "bg-sun text-ink ring-2 ring-sun/40 hover:brightness-105"
                          : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {stage.done ? "✓ " : ui.stepNumber(i)}
                    {stage.command}
                  </button>
                  {i < mission.stages.length - 1 && (
                    <span className="text-slate-500" aria-hidden>
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-2 space-y-1">
              {mission.stages.map((stage, i) => (
                <li
                  key={stage.label}
                  className={`flex gap-1.5 text-xs ${stage.done ? "text-mint" : i === current ? "text-white" : "text-slate-400"}`}
                >
                  <span className={`shrink-0 font-mono ${i === current ? "text-sun" : ""}`}>{stage.done ? "✓" : ui.stepNumber(i)}</span>
                  <span className="min-w-0">
                    <RichText text={stage.label} codeClassName="rounded bg-white/10 px-1 font-mono text-[11px]" />
                  </span>
                </li>
              ))}
            </ol>
          )}
          {overview}
        </>
      )}
    </div>
  );
}
