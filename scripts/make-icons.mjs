// Renders PNG icons from public/icons/icon.svg using the pre-installed Playwright Chromium.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require(require("node:child_process").execSync("npm root -g").toString().trim() + "/playwright")); }
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(size, out, maskable = false) {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#2b5fd9;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: out, omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
}
await render(192, "public/icons/icon-192.png");
await render(512, "public/icons/icon-512.png");
await render(512, "public/icons/icon-maskable-512.png", true);
// iOS ignores transparency: full-bleed square
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(`<html><body style="margin:0"><div style="width:180px;height:180px">${svg.replace('rx="112"', 'rx="0"')}</div></body></html>`);
await page.screenshot({ path: "public/icons/apple-touch-icon.png", clip: { x: 0, y: 0, width: 180, height: 180 } });
await browser.close();
console.log("icons written");
