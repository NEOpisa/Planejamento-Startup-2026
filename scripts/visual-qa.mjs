import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const server = spawn("node", ["server.mjs"], {
  env: { ...process.env, PORT: "3411", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));
const deadline = Date.now() + 30000;
while (!output.includes("NVDISC em") && Date.now() < deadline)
  await new Promise((r) => setTimeout(r, 150));
if (!output.includes("NVDISC em")) {
  server.kill();
  throw Error(output);
}
const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const context = await browser.newContext();
const page = await context.newPage();
await mkdir("artifacts", { recursive: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(
      (process.env.QA_URL || "http://localhost:3411") + "/NVDISC",
    );
    await page.waitForSelector("#nome");
    await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${name}: overflow`,
    );
    console.log(
      name,
      await page.title(),
      await page.locator("h1").innerText(),
      "overflow",
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#nome").fill("Neo");
  await page.locator("#sala").fill("design-review");
  await page.locator("button[type=submit]").click();
  await page.waitForSelector(".nv-pessoa");
  await page.waitForFunction(() =>
    document
      .querySelector(".nv-canal-gente")
      ?.textContent.includes("1 na sala"),
  );
  await page.screenshot({ path: "artifacts/sala.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  assert.ok(
    await page
      .locator(".nv-controles")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().bottom <= innerHeight &&
          getComputedStyle(el).opacity === "1",
      ),
    "controles visíveis no celular",
  );
  await page.screenshot({ path: "artifacts/sala-mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "room overflow",
  );
  assert.deepEqual(errors, []);
  console.log("room", await page.locator("h1").innerText(), "errors", errors);
} finally {
  await context.close();
  await browser.close();
  server.kill("SIGTERM");
}
