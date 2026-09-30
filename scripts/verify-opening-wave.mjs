import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const distRoot = resolve("dist");
const mountPath = "/space-birthday-34/";
const outputDir = process.env.VERIFY_OUTPUT_DIR ?? "/tmp/space-birthday-34-verification";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/run/current-system/sw/bin/chromium";
const mimeTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const samples = [];
let browser;

execFileSync("npm", ["run", "build"], { stdio: "inherit" });
await mkdir(outputDir, { recursive: true });

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (!pathname.startsWith(mountPath)) { response.writeHead(404).end("Not found"); return; }
  const relativePath = decodeURIComponent(pathname.slice(mountPath.length)) || "index.html";
  const filePath = resolve(distRoot, relativePath);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch { response.writeHead(404).end("Not found"); }
});

try {
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${mountPath}?test=1`;
  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /играть|начать|старт/i }).click();
  await page.waitForFunction(() => window.__SPACE_BIRTHDAY_TEST__.getState().screen === "playing", undefined, { timeout: 5_000 });

  for (let cycle = 0; cycle < 11; cycle += 1) {
    const direction = cycle % 2 === 0 ? "ArrowRight" : "ArrowLeft";
    await page.keyboard.down(direction);
    await page.waitForTimeout(4_000);
    await page.keyboard.up(direction);
    const state = await page.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.getState());
    samples.push({ elapsedSeconds: Math.round(state.elapsedSeconds), health: state.health, screen: state.screen });
    if (state.screen !== "playing") break;
  }
  const finalState = await page.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.getState());
  const screenshot = `${outputDir}/opening-wave-44s.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  assert.equal(finalState.screen, "playing", `opening wave ended early: ${JSON.stringify(finalState)}`);
  assert.ok(finalState.health > 0, "player lost all health during the 44-second opening-wave run");
  console.log(JSON.stringify({ result: "PASS", durationSeconds: Math.round(finalState.elapsedSeconds), health: finalState.health, samples, screenshot }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
