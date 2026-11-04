// `out/` ফোল্ডারের স্ট্যাটিক সাইট লোকালি দেখানোর ছোট সার্ভার (প্রিভিউ আর e2e টেস্টের জন্য)।
// বাইরের কোনো প্যাকেজ লাগে না। ব্যবহার: node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4321);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  // "../" দিয়ে out/-এর বাইরে যাওয়া আটকাই
  const path = normalize(join(root, decodeURIComponent(urlPath.split("?")[0])));
  if (!path.startsWith(root)) return null;
  for (const candidate of [path, join(path, "index.html"), `${path}.html`]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // পরেরটা দেখি
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = (await resolveFile(req.url ?? "/")) ?? join(root, "404.html");
  try {
    const body = await readFile(file);
    res.writeHead(file.endsWith("404.html") && !req.url?.includes("404") ? 404 : 200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}`));
