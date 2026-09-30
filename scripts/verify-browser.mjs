import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const repository = process.cwd();
const outputDir = process.env.VERIFY_OUTPUT_DIR ?? "/tmp/space-birthday-34-verification";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/run/current-system/sw/bin/chromium";
const errors = [];
let server;
let browser;

async function freePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited early with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not become ready at ${url}`);
}

function watchErrors(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()} at ${JSON.stringify(message.location())}`);
  });
  page.on("pageerror", (error) => errors.push(`${label} page: ${error.message}`));
  page.on("requestfailed", (request) => errors.push(`${label} request failed: ${request.url()} (${request.failure()?.errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

async function getGameState(page) {
  return page.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.getState());
}

async function renderedPlayer(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.game-canvas");
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    const state = window.__SPACE_BIRTHDAY_TEST__.getState();
    const scale = Math.min(rect.width / 480, rect.height / 800);
    const offsetX = (rect.width - 480 * scale) / 2;
    const offsetY = (rect.height - 800 * scale) / 2;
    const expectedX = (rect.x + offsetX + state.player.x * scale) * devicePixelRatio;
    const expectedY = (rect.y + offsetY + state.player.y * scale) * devicePixelRatio;
    const halfWidth = Math.ceil(16 * scale * devicePixelRatio);
    const halfHeight = Math.ceil(20 * scale * devicePixelRatio);
    const left = Math.max(0, Math.floor(expectedX - halfWidth));
    const right = Math.min(canvas.width, Math.ceil(expectedX + halfWidth));
    const top = Math.max(0, Math.floor(expectedY - halfHeight));
    const bottom = Math.min(canvas.height, Math.ceil(expectedY + halfHeight));
    const pixels = context.getImageData(left, top, right - left, bottom - top);
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < pixels.height; y += 1) {
      for (let x = 0; x < pixels.width; x += 1) {
        const i = (y * pixels.width + x) * 4;
        if (pixels.data[i] !== 82 || pixels.data[i + 1] !== 229 || pixels.data[i + 2] !== 243 || pixels.data[i + 3] < 240) continue;
        const px = left + x;
        const py = top + y;
        count += 1;
        sumX += px;
        sumY += py;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
    return {
      dpr: devicePixelRatio,
      player: state.player,
      canvas: { width: canvas.width, height: canvas.height, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
      expected: { x: expectedX, y: expectedY },
      hull: { count, center: count ? { x: sumX / count, y: sumY / count } : null, bounds: { minX, minY, maxX, maxY } },
      scale,
    };
  });
}

async function assertPlayerRendered(page, label) {
  const result = await renderedPlayer(page);
  assert.ok(result.hull.count > 10, `${label}: player hull color was not rendered near the expected position: ${JSON.stringify(result)}`);
  const tolerance = Math.max(2, result.scale * result.dpr * 3);
  assert.ok(Math.abs(result.hull.center.x - result.expected.x) <= tolerance, `${label}: rendered player is horizontally displaced: ${JSON.stringify(result)}`);
  assert.ok(Math.abs(result.hull.center.y - (result.expected.y - result.scale * result.dpr * 7)) <= tolerance, `${label}: rendered player is vertically displaced: ${JSON.stringify(result)}`);
  assert.ok(result.hull.bounds.minX > 0 && result.hull.bounds.maxX < result.canvas.width, `${label}: player hull is clipped horizontally: ${JSON.stringify(result)}`);
  return result;
}

async function clickStart(page, { touch = false } = {}) {
  const startButton = page.getByRole("button", { name: /играть|начать|старт/i }).first();
  await startButton.waitFor({ state: "visible", timeout: 8_000 });
  if (touch) {
    const box = await startButton.boundingBox();
    assert.ok(box, "mobile start button has no layout box");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await startButton.click();
  }
  await page.waitForFunction(() => !document.querySelector(".hud")?.classList.contains("hidden"), { timeout: 5_000 });
  assert.ok(await page.locator("canvas.game-canvas").isVisible(), "game canvas is not visible after starting");
}

try {
  await mkdir(outputDir, { recursive: true });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repository,
    stdio: "ignore",
  });
  await waitForServer(baseUrl);

  browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watchErrors(desktop, "desktop");
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  await desktop.locator("#game-root").waitFor({ state: "visible" });
  assert.equal(await desktop.evaluate(() => typeof window.__SPACE_BIRTHDAY_TEST__), "undefined", "test hook is exposed outside opt-in mode");
  assert.equal(await desktop.locator(".vite-error-overlay").count(), 0, "desktop: Vite error overlay rendered");
  const desktopTitle = await desktop.locator(".landing-screen").innerText();
  assert.match(desktopTitle, /Спецвузавтоматика/, "desktop title must keep the exact company spelling");
  assert.match(desktopTitle, /34/, "desktop title must show the 34-year anniversary");
  await desktop.screenshot({ path: `${outputDir}/desktop-title.png`, fullPage: true });
  await clickStart(desktop);
  await desktop.keyboard.press("ArrowRight");
  await desktop.keyboard.press("Space");
  await desktop.waitForTimeout(250);
  await desktop.screenshot({ path: `${outputDir}/desktop-playing.png`, fullPage: true });

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  watchErrors(mobile, "mobile");
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  await mobile.locator("#game-root").waitFor({ state: "visible" });
  assert.equal(await mobile.evaluate(() => typeof window.__SPACE_BIRTHDAY_TEST__), "undefined", "mobile test hook is exposed outside opt-in mode");
  assert.match(await mobile.locator(".landing-screen").innerText(), /Спецвузавтоматика/, "mobile title must keep the exact company spelling");
  await mobile.screenshot({ path: `${outputDir}/mobile-title.png`, fullPage: true });
  await clickStart(mobile, { touch: true });
  const mobileDimensions = await mobile.evaluate(() => ({ width: window.innerWidth, body: document.body.scrollWidth }));
  assert.ok(mobileDimensions.body <= mobileDimensions.width + 1, `mobile horizontal overflow: ${JSON.stringify(mobileDimensions)}`);
  await mobile.touchscreen.tap(195, 422);
  await mobile.waitForTimeout(250);
  await mobile.screenshot({ path: `${outputDir}/mobile-playing.png`, fullPage: true });

  const testPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watchErrors(testPage, "test-hook");
  await testPage.goto(`${baseUrl}/?test=1`, { waitUntil: "networkidle" });
  await testPage.waitForFunction(() => typeof window.__SPACE_BIRTHDAY_TEST__?.getState === "function");
  const initialState = await getGameState(testPage);
  await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.startLevel(1));
  await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.setPlayerPosition(240, 400));
  await testPage.waitForTimeout(120);
  const desktopRenderedPlayer = await assertPlayerRendered(testPage, "desktop DPR1 centered player");
  await testPage.screenshot({ path: `${outputDir}/desktop-dpr1-center.png`, fullPage: true });
  await testPage.locator("canvas.game-canvas").focus();
  const keyboardBefore = await getGameState(testPage);
  await testPage.keyboard.down("ArrowRight");
  await testPage.waitForTimeout(240);
  await testPage.keyboard.up("ArrowRight");
  const keyboardAfter = await getGameState(testPage);
  assert.ok(keyboardAfter.player.x > keyboardBefore.player.x + 8, "desktop keyboard input did not move the ship");

  await testPage.locator(".pause-button").click();
  assert.equal((await getGameState(testPage)).screen, "paused", "pause control did not pause the game");
  const pausedClock = (await getGameState(testPage)).elapsedSeconds;
  await testPage.waitForTimeout(650);
  const stillPausedClock = (await getGameState(testPage)).elapsedSeconds;
  assert.ok(Math.abs(stillPausedClock - pausedClock) < 0.02, `game clock advanced during pause (${pausedClock} → ${stillPausedClock})`);
  await testPage.getByRole("button", { name: /продолжить/i }).click();
  await testPage.waitForTimeout(250);
  const resumedState = await getGameState(testPage);
  assert.equal(resumedState.screen, "playing", "resume control did not return to play");
  assert.ok(resumedState.elapsedSeconds > stillPausedClock, "game clock did not resume");

  await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.setHealth(1));
  await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.damagePlayer());
  await testPage.getByRole("button", { name: /повторить орбиту/i }).waitFor({ state: "visible" });
  assert.equal((await getGameState(testPage)).screen, "lost", "one-HP hit did not reach the loss state");
  await testPage.waitForTimeout(450);
  await testPage.screenshot({ path: `${outputDir}/game-over.png`, fullPage: true });
  await testPage.getByRole("button", { name: /повторить орбиту/i }).click();
  await testPage.waitForFunction(() => window.__SPACE_BIRTHDAY_TEST__.getState().screen === "playing");
  const retryState = await getGameState(testPage);
  assert.equal(retryState.health, 5, "retry did not restore the ship's health");
  assert.ok(Object.values(retryState.effects).every((remaining) => remaining === 0), "retry did not clear status effects");
  await testPage.screenshot({ path: `${outputDir}/retry-playing.png`, fullPage: true });

  await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.startLevel(1));
  const transitions = [];
  for (let boss = 0; boss < 5; boss += 1) {
    await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.advanceToBoss());
    const active = await getGameState(testPage);
    assert.equal(active.bossIndex, boss, `expected boss ${boss + 1} to be active`);
    assert.ok(active.bossHealth > 0, `boss ${boss + 1} has no health`);
    if (boss === 4) {
      await testPage.waitForTimeout(450);
      await testPage.screenshot({ path: `${outputDir}/boss-5.png`, fullPage: true });
    }
    await testPage.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.defeatCurrentBoss());
    const after = await getGameState(testPage);
    assert.equal(after.bossesDefeated, boss + 1, `boss ${boss + 1} did not advance progression`);
    transitions.push({ bossIndex: active.bossIndex, level: active.level, bossesDefeated: after.bossesDefeated, screen: after.screen });
  }
  const victoryState = await getGameState(testPage);
  assert.equal(victoryState.screen, "won", "defeating all five bosses did not reach victory");
  await testPage.getByRole("button", { name: /ещё один полёт/i }).waitFor({ state: "visible" });
  await testPage.waitForTimeout(450);
  await testPage.screenshot({ path: `${outputDir}/victory.png`, fullPage: true });
  await testPage.getByRole("button", { name: /ещё один полёт/i }).click();
  await testPage.waitForFunction(() => window.__SPACE_BIRTHDAY_TEST__.getState().screen === "playing");
  assert.equal((await getGameState(testPage)).level, 1, "victory replay did not start the first orbit");

  const renderedMobilePlayers = [];
  for (const dpr of [2, 3]) {
    const mobileTest = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: dpr,
      isMobile: true,
      hasTouch: true,
    });
    watchErrors(mobileTest, `mobile-dpr${dpr}-test-hook`);
    await mobileTest.goto(`${baseUrl}/?test=1`, { waitUntil: "networkidle" });
    await mobileTest.waitForFunction(() => typeof window.__SPACE_BIRTHDAY_TEST__?.getState === "function");
    await mobileTest.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.startLevel(1));
    for (const [label, x] of [["center", 240], ["left edge", 24], ["right edge", 456]]) {
      await mobileTest.evaluate((positionX) => window.__SPACE_BIRTHDAY_TEST__.setPlayerPosition(positionX, 400), x);
      await mobileTest.waitForTimeout(140);
      const rendered = await assertPlayerRendered(mobileTest, `mobile DPR${dpr} ${label}`);
      renderedMobilePlayers.push({ dpr, label, player: rendered.player, renderedCenter: rendered.hull.center, bounds: rendered.hull.bounds, canvas: rendered.canvas });
      if (label === "center") await mobileTest.screenshot({ path: `${outputDir}/mobile-dpr${dpr}-center.png`, fullPage: true });
    }

    await mobileTest.evaluate(() => window.__SPACE_BIRTHDAY_TEST__.setPlayerPosition(240, 400));
    const mobileBefore = await getGameState(mobileTest);
    const canvasBox = await mobileTest.locator("canvas.game-canvas").boundingBox();
    assert.ok(canvasBox, `mobile DPR${dpr} canvas has no layout box`);
    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;
    const touch = await mobileTest.context().newCDPSession(mobileTest);
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y: startY, id: 1 }] });
    for (let step = 1; step <= 4; step += 1) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX + step * 12, y: startY - step * 8, id: 1 }] });
      await mobileTest.waitForTimeout(45);
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const mobileAfter = await getGameState(mobileTest);
    assert.ok(mobileAfter.player.x > mobileBefore.player.x + 12, `mobile DPR${dpr} touch drag did not move the ship horizontally`);
    assert.ok(mobileAfter.player.y < mobileBefore.player.y - 8, `mobile DPR${dpr} touch drag did not move the ship vertically`);
    await mobileTest.waitForTimeout(100);
    await assertPlayerRendered(mobileTest, `mobile DPR${dpr} touch-moved player`);
    await mobileTest.screenshot({ path: `${outputDir}/mobile-dpr${dpr}-touch-play.png`, fullPage: true });
    await mobileTest.close();
  }

  assert.deepEqual(errors, [], `browser errors detected:\n${errors.join("\n")}`);
  console.log(JSON.stringify({
    result: "PASS",
    browser: await browser.version(),
    screenshots: outputDir,
    desktop: "normal title→play flow; keyboard movement and fire input",
    mobile: "normal title→play flow by touch; no horizontal overflow; touch drag moved the ship",
    pause: { clockBeforePause: pausedClock, clockWhilePaused: stillPausedClock, clockAfterResume: resumedState.elapsedSeconds },
    retry: "one-HP damage showed loss dialog; retry restored five HP and resumed play",
    testHook: { initialState, keyboardMove: { from: keyboardBefore.player, to: keyboardAfter.player }, transitions, victory: victoryState.screen },
    renderedPlayers: { desktopDpr1: desktopRenderedPlayer, mobileDpr2And3: renderedMobilePlayers },
    browserErrors: errors,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
}
