"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Repo } from "@/lib/git/types";
import { GAP_Y, PAD_TOP, layoutGraph, type EdgeLayout } from "@/lib/graph/layout";

const NODE_R = 13;
const LABEL_H = 20;

function edgePath(e: EdgeLayout): string {
  const { from, to } = e;
  if (from.y === to.y) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  // অন্য লেনে গেলে মসৃণ বাঁক
  const mid = from.x + Math.min(70, (to.x - from.x) * 0.6);
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${Math.min(mid + 30, to.x)} ${to.y} L ${to.x} ${to.y}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** প্রতি অক্ষর মোটামুটি কত পিক্সেল (লেবেলের প্রস্থ আন্দাজ করতে) */
const textWidth = (text: string, px = 7.4) => text.length * px;

export function CommitGraph({ repo }: { repo: Repo | null }) {
  const layout = useMemo(() => layoutGraph(repo), [repo]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, [layout.nodes.length]);

  return (
    <section
      aria-label="commit গ্রাফ"
      className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl bg-ink shadow-lg ring-1 ring-white/10"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-100">Commit গ্রাফ</h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-300">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sun" aria-hidden /> HEAD = আপনি এখানে
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-mint" aria-hidden /> merge commit
          </span>
        </div>
      </div>

      {layout.nodes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-300">
          {repo ? (
            <p>
              এখনো কোনো commit নেই।
              <br />
              প্রথম commit করলে এখানে একটা বৃত্ত দেখা যাবে।
            </p>
          ) : (
            <p>
              রিপোজিটরি নেই। শুরু করতে টার্মিনালে লিখুন <code className="font-mono text-mint">git init</code>
            </p>
          )}
        </div>
      ) : (
        <div ref={scrollRef} className="graph-scroll flex-1 overflow-auto">
          <svg
            width={Math.max(layout.width, 320)}
            height={layout.height}
            viewBox={`0 0 ${Math.max(layout.width, 320)} ${layout.height}`}
            role="img"
            aria-label={`${layout.nodes.length}টা commit, ${layout.labels.length}টা branch`}
            className="block"
          >
            {/* লেনের হালকা রেখা */}
            {Array.from({ length: layout.lanes }, (_, lane) => (
              <line
                key={`lane-${lane}`}
                x1={0}
                x2={Math.max(layout.width, 320)}
                y1={PAD_TOP + lane * GAP_Y}
                y2={PAD_TOP + lane * GAP_Y}
                stroke="#ffffff"
                strokeOpacity={0.04}
                strokeWidth={24}
              />
            ))}

            {layout.edges.map((e) => (
              <path
                key={e.key}
                d={edgePath(e)}
                pathLength={1}
                fill="none"
                stroke={e.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeOpacity={e.secondary ? 0.9 : 1}
                className="edge-draw"
              />
            ))}

            {layout.nodes.map((n) => (
              <g key={n.id} className="graph-move" style={{ transform: `translate(${n.x}px, ${n.y}px)` }}>
                <g className="commit-pop">
                  <title>{`${n.id}: ${n.message}`}</title>
                  {n.isMerge ? (
                    <>
                      <circle r={NODE_R} fill="#14213D" stroke={n.color} strokeWidth={4} />
                      <circle r={NODE_R - 7} fill={n.color} />
                    </>
                  ) : (
                    <circle r={NODE_R} fill={n.color} stroke="#14213D" strokeWidth={3} />
                  )}
                </g>
                <text y={NODE_R + 16} textAnchor="middle" className="fill-slate-300 font-mono" fontSize={11}>
                  {n.id}
                </text>
                <text y={NODE_R + 31} textAnchor="middle" className="fill-white" fontSize={12}>
                  {truncate(n.message, 16)}
                </text>
              </g>
            ))}

            {layout.labels.map((l) => {
              const node = nodeById.get(l.commitId);
              if (!node) return null;
              const name = truncate(l.branch, 14);
              const w = textWidth(name) + 16;
              const headW = l.isHead ? textWidth("HEAD", 6.6) + 14 : 0;
              const total = w + (l.isHead ? headW + 4 : 0);
              const y = -NODE_R - 10 - LABEL_H - l.stack * (LABEL_H + 4);
              return (
                <g
                  key={`label-${l.branch}`}
                  className="graph-move"
                  style={{ transform: `translate(${Math.max(4, node.x - total / 2)}px, ${node.y + y}px)` }}
                >
                  {l.isHead && (
                    <g>
                      <rect width={headW} height={LABEL_H} rx={6} fill="#FFB020" />
                      <text x={headW / 2} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#14213D" className="font-mono">
                        HEAD
                      </text>
                    </g>
                  )}
                  <g style={{ transform: `translateX(${l.isHead ? headW + 4 : 0}px)` }}>
                    <rect
                      width={w}
                      height={LABEL_H}
                      rx={6}
                      fill={l.color}
                      stroke={l.isHead ? "#FFB020" : "none"}
                      strokeWidth={l.isHead ? 2 : 0}
                    />
                    <text
                      x={w / 2}
                      y={14}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill={l.color === "#4F46E5" ? "#FFFFFF" : "#14213D"}
                      className="font-mono"
                    >
                      {name}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
