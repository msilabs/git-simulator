/** `ব্যাকটিক` দিয়ে ঘেরা অংশকে কোডের মতো দেখায়। */
export function RichText({ text, codeClassName }: { text: string; codeClassName?: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code key={i} className={codeClassName ?? "rounded bg-white/10 px-1 font-mono text-[0.92em]"}>
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
