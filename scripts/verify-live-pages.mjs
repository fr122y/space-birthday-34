import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PAGES_URL ?? "https://fr122y.github.io/space-birthday-34/";
const outputDir = process.env.VERIFY_OUTPUT_DIR ?? "/tmp/space-birthday-34-verification";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/run/current-system/sw/bin/chromium";
const errors = [];
let browser;

function watchErrors(page, label) {
  page.on("console", (message) => { if (message.type() === "error") errors.push(`${label} console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`${label} page: ${error.message}`));
  page.on("response", (response) => { if (response.status() >= 400) errors.push(`${label} HTTP ${response.status()}: ${response.url()}`); });
}

async function checkViewport(page, label, { touch = false } = {}) {
  watchErrors(page, label);
  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  assert.equal(response.status(), 200, `${label}: site response was not 200`);
  await page.locator(".play-button").waitFor({ state: "visible" });
  const title = await page.locator(".landing-screen").innerText();
  assert.match(title, /Спецвузавтоматика/, `${label}: company spelling is incorrect`);
  assert.match(title, /34/, `${label}: anniversary is not shown`);
  assert.equal(await page.evaluate(() => typeof window.__SPACE_BIRTHDAY_TEST__), "undefined", `${label}: test hook leaked into production`);
  const origin = new URL(baseUrl).origin;
  const prefix = new URL(baseUrl).pathname;
  const localResources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name).filter((url) => new URL(url).origin === location.origin));
  assert.ok(localResources.every((url) => new URL(url).pathname.startsWith(prefix)), `${label}: a local resource escaped the project path`);
  await page.screenshot({ path: `${outputDir}/live-${label}-title.png`, fullPage: true });
  const start = page.getByRole("button", { name: /играть|начать|старт/i }).first();
  if (touch) {
    const box = await start.boundingBox();
    assert.ok(box, `${label}: start button has no layout box`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await start.click();
  }
  await page.waitForFunction(() => !document.querySelector(".hud")?.classList.contains("hidden"), { timeout: 5_000 });
  assert.ok(await page.locator("canvas.game-canvas").isVisible(), `${label}: game canvas did not open`);
  if (touch) {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth }));
    assert.ok(dimensions.body <= dimensions.width + 1, `${label}: horizontal overflow`);
    await page.touchscreen.tap(195, 422);
  } else {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outputDir}/live-${label}-playing.png`, fullPage: true });
  return { viewport: label, localResources: localResources.length, origin };
}

try {
  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const desktopResult = await checkViewport(desktop, "desktop");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mobileResult = await checkViewport(mobile, "mobile", { touch: true });
  assert.deepEqual(errors, [], `live Pages browser errors:\n${errors.join("\n")}`);
  console.log(JSON.stringify({ result: "PASS", url: baseUrl, browser: await browser.version(), desktop: desktopResult, mobile: mobileResult, screenshots: outputDir, browserErrors: errors }, null, 2));
} finally {
  if (browser) await browser.close();
}
