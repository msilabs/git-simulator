/**
 * টার্মিনালে কমান্ডের আউটপুট। diff আর conflict চিহ্নকে আসল টার্মিনালের মতো রঙ দেয়:
 * `+` লাইন সবুজ, `-` লাইন লাল, `@@` hunk নীল, `<<<<<<<`/`=======`/`>>>>>>>` হলুদ।
 */
const MARKER = /^(<{7}|={7}|>{7})( |$)/;

function lineClass(line: string, isDiff: boolean): string {
  if (MARKER.test(line)) return "text-sun font-bold";
  if (!isDiff) return "";
  if (/^(diff --git|index |new file mode|deleted file mode|--- |\+\+\+ )/.test(line)) return "text-white font-bold";
  if (line.startsWith("@@")) return "text-[#38BDF8]";
  if (line.startsWith("+")) return "text-mint";
  if (line.startsWith("-")) return "text-danger";
  return "";
}

export function OutputBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const isDiff = lines[0]?.startsWith("diff --git") ?? false;
  if (!isDiff && !lines.some((l) => MARKER.test(l))) return <>{text}</>;
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={lineClass(line, isDiff)}>
          {line || " "}
        </div>
      ))}
    </>
  );
}
