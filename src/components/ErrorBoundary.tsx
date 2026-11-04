"use client";

import { Component, type ReactNode } from "react";
import { clearSession } from "@/lib/storage";
import { ui } from "@/lib/ui-text";

/**
 * রেন্ডারে কোনো এরর হলে সাদা পেজের বদলে বাংলায় বার্তা আর "সব মুছে নতুন করে শুরু" বোতাম দেখায়,
 * যাতে নষ্ট সেভ ডেটায় ব্যবহারকারী আটকে না যায়।
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="grid min-h-dvh place-items-center bg-cloud p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-ink/10">
          <h1 className="text-lg font-bold text-ink">{ui.crashTitle}</h1>
          <p className="mt-2 text-sm text-slate">{ui.crashBody}</p>
          <button
            type="button"
            onClick={() => {
              clearSession();
              window.location.reload();
            }}
            className="mt-5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-3"
          >
            {ui.crashReset}
          </button>
        </div>
      </main>
    );
  }
}
