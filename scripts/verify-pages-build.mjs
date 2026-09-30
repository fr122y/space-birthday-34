import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const distRoot = resolve("dist");
const mountPath = "/space-birthday-34/";
const outputPath = process.env.VERIFY_OUTPUT_DIR ?? "/tmp/space-birthday-34-verification";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/run/current-system/sw/bin/chromium";
const mimeTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const errors = [];

async function builtFiles(directory = distRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await builtFiles(path));
    else paths.push(path);
  }
  return paths;
}

const built = await builtFiles();
const htmlPath = resolve(distRoot, "index.html");
const html = await readFile(htmlPath, "utf8");
const jsPath = built.find((path) => path.endsWith(".js"));
assert.ok(jsPath, "Vite build produced no JavaScript bundle");
const js = await readFile(jsPath, "utf8");
assert.match(html, /(?:src|href)="\.\//, "built HTML has no relative asset references");
assert.ok(!/\b(?:src|href)="\/(?:assets|favicon)/.test(html), "built HTML contains root-absolute static assets");
assert.ok(!js.includes('"/assets/'), "built JavaScript contains root-absolute sprite URLs");
assert.ok(js.includes("./assets/"), "built JavaScript does not use the relative Vite base URL for sprites");

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (!pathname.startsWith(mountPath)) {
    response.writeHead(404).end("Not found");
    return;
  }
  const relativePath = decodeURIComponent(pathname.slice(mountPath.length)) || "index.html";
  const filePath = resolve(distRoot, relativePath);
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

let browser;
try {
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  const response = await page.goto(`${origin}${mountPath}`, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, "Pages subpath returned a non-200 response");
  await page.locator(".play-button").waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  const resourceUrls = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  const originPrefix = `${origin}${mountPath}`;
  assert.ok(resourceUrls.length > 0, "browser loaded no page resources");
  const localResources = resourceUrls.filter((url) => new URL(url).origin === origin);
  assert.ok(localResources.every((url) => url.startsWith(originPrefix)), `local resource escaped Pages subpath: ${localResources.filter((url) => !url.startsWith(originPrefix)).join(", ")}`);
  assert.deepEqual(errors, [], `Pages subpath browser errors:\n${errors.join("\n")}`);
  const screenshot = `${outputPath}/pages-subpath-mobile.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ result: "PASS", mountPath, resources: resourceUrls.length, externalResources: resourceUrls.filter((url) => new URL(url).origin !== origin), screenshot, browserErrors: errors }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}
