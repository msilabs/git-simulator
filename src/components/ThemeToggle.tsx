"use client";

import { useEffect } from "react";
import { ui } from "@/lib/ui-text";

export const THEME_KEY = "msilabs-git-simulator:theme";

/**
 * পেজ আঁকার আগেই থিম বসায় (layout-এর <head>-এ চলে), যাতে এক ঝলক ভুল রং না দেখায়।
 * আগে বেছে নেওয়া থিম থাকলে সেটা, নাহলে সিস্টেমের থিম।
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

const savedTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
};

/**
 * আলো/অন্ধকার থিমের বোতাম। কোন icon দেখাবে তা CSS ঠিক করে (data-theme দেখে),
 * তাই সার্ভারের HTML আর ব্রাউজারের প্রথম রেন্ডার মিলে যায়।
 */
export function ThemeToggle({ className }: { className: string }) {
  // নিজে কিছু বেছে না নিলে সিস্টেমের থিম বদলালে সাথে সাথে বদলায়
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = (e: MediaQueryListEvent) => {
      if (!savedTheme()) document.documentElement.dataset.theme = e.matches ? "dark" : "light";
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // প্রাইভেট উইন্ডোতে মনে রাখা না গেলেও এবারের জন্য বদলায়
    }
  };

  return (
    <button type="button" onClick={toggle} aria-label={ui.themeToggle} title={ui.themeToggle} className={className}>
      <span aria-hidden className="dark:hidden">
        ☾
      </span>
      <span aria-hidden className="hidden dark:inline">
        ☀
      </span>
    </button>
  );
}
