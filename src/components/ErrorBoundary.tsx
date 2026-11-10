"use client";

import { Component, type ReactNode } from "react";
import { clearSession } from "@/lib/storage";
import { ui } from "@/lib/ui-text";

/**
 * রেন্ডারে কোনো এরর হলে সাদা পেজের বদলে বাংলায় বার্তা দেখায়।
 * যে কমান্ডে ভাঙল সেটা সেভ হয় না, তাই প্রথম উপায় শুধু রিলোড: আগের কাজ ফিরে আসে।
 * সেভ করা অবস্থাটাই নষ্ট হলে রিলোডেও ভাঙবে; তখন "সব মুছে নতুন করে শুরু"।
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="grid min-h-dvh place-items-center bg-page p-4">
        <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-line/10">
          <h1 className="text-lg font-bold text-fg">{ui.crashTitle}</h1>
          <p className="mt-2 text-sm text-muted">{ui.crashBody}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
            >
              {ui.crashReload}
            </button>
            <button
              type="button"
              onClick={() => {
                clearSession();
                window.location.reload();
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-fg ring-1 ring-line/20 hover:bg-chip"
            >
              {ui.crashReset}
            </button>
          </div>
        </div>
      </main>
    );
  }
}
