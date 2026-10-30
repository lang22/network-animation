#!/usr/bin/env node
/**
 * 拥塞控制页面的可视化验收。
 *
 * 用法：
 *   1) npm start           # 先起 dev server
 *   2) npm run verify:ui
 *
 * 用系统里已装的 Edge / Chrome（playwright-core 只驱动浏览器，不额外下载 Chromium），
 * 检查：页面不出滚动条、画布不被撑出视口、飞行小球不越界、快重传能触发且不依赖 RTO。
 * 截图输出到 artifacts/ui/。
 *
 * 可用环境变量覆盖：VERIFY_URL、CHROME_PATH。
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.VERIFY_URL ?? 'http://localhost:3000/protocol/congestion';
const outDir = path.resolve('artifacts/ui');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = browsers.find(candidate => existsSync(candidate));
if (!executablePath) {
  console.error('未找到 Edge/Chrome，可用 CHROME_PATH 指定可执行文件路径');
  process.exit(2);
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const text = page => page.evaluate(() => document.body.innerText);
const numberAfter = (source, label) => {
  const match = source.match(new RegExp(`${label}\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
};

/** 点开/点关某个开关行：label 文本所在 div 的最后一个子元素就是 Toggle */
const toggleByLabel = (page, label) => page.evaluate(name => {
  const row = [...document.querySelectorAll('div')].find(d => d.textContent?.trim() === name);
  row?.lastElementChild?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}, label);

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'load' });
  await sleep(1200);
  await page.screenshot({ path: path.join(outDir, 'idle.png') });

  check(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
    '页面出现了纵向滚动条');

  const canvasBox = await page.getByTestId('congestion-canvas').boundingBox();
  check(canvasBox && canvasBox.y + canvasBox.height <= 900 + 1, '画布超出视口高度');

  // ── 场景 1：无丢包，检查多包飞行时小球是否都在画布内 ──
  await page.getByRole('button', { name: '0%', exact: true }).click();
  await page.getByRole('button', { name: '2x' }).click();
  await page.getByRole('button', { name: '⚡ 完整演示' }).click();

  let ballsShot = false;
  for (let i = 0; i < 400 && !ballsShot; i += 1) {
    await sleep(100);
    const snapshot = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('span')].filter(s => /^#\d+$/.test(s.textContent.trim()));
      const box = document.querySelector('[data-testid="congestion-canvas"]').getBoundingClientRect();
      return {
        count: labels.length,
        canvas: { top: box.top, bottom: box.bottom },
        balls: labels.map(s => s.parentElement.getBoundingClientRect())
          .map(r => ({ top: r.top, bottom: r.bottom })),
      };
    });
    if (snapshot.count >= 10) {
      const outside = snapshot.balls.filter(ball => ball.top < snapshot.canvas.top - 1 || ball.bottom > snapshot.canvas.bottom + 1);
      check(outside.length === 0, `${outside.length} 个飞行小球越出画布（批次 ${snapshot.count} 个包）`);
      await page.screenshot({ path: path.join(outDir, 'inflight.png') });
      ballsShot = true;
    }
  }
  check(ballsShot, '演示中没捕捉到 10 个以上的并行小球');

  // ── 场景 2：指定丢两个包，验证 NewReno 逐个补发 ──
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  await toggleByLabel(page, '丢包模拟');
  await page.getByRole('button', { name: '0%', exact: true }).click();
  // 同一窗口丢两个包：先快重传 #8，收到部分 ACK 12 后再补发 #12（NewReno）
  await page.locator('input[placeholder="8,12"]').fill('8,12');
  await page.getByRole('button', { name: '2x' }).click();
  await page.getByRole('button', { name: '⚡ 完整演示' }).click();

  let partialAcks = 0;
  for (let i = 0; i < 400 && partialAcks === 0; i += 1) {
    await sleep(100);
    partialAcks = numberAfter(await text(page), '部分 ACK');
  }
  const stats = await text(page);
  check(numberAfter(stats, '快重传') >= 1, '指定丢包后没有触发快重传');
  check(partialAcks >= 1, '同一窗口两个丢包没有触发部分确认补发（NewReno）');
  check(numberAfter(stats, '重复 ACK') >= 3, '重复 ACK 计数不足 3');
  check(numberAfter(stats, 'RTO 超时') === 0, '快重传路径上仍然走了 RTO');
  await page.screenshot({ path: path.join(outDir, 'fast-retransmit.png') });

  // ── 场景 3：开启 SACK，同样的两个缺口应该一次补齐 ──
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  await toggleByLabel(page, '丢包模拟');
  await toggleByLabel(page, '选择确认 SACK');
  await page.getByRole('button', { name: '0%', exact: true }).click();
  await page.locator('input[placeholder="8,12"]').fill('8,12');
  await page.getByRole('button', { name: '2x' }).click();
  await page.getByRole('button', { name: '⚡ 完整演示' }).click();

  let sackDone = false;
  for (let i = 0; i < 400 && !sackDone; i += 1) {
    await sleep(100);
    sackDone = (await text(page)).includes('一次补齐');
  }
  const sackStats = await text(page);
  check(sackDone, 'SACK 模式下没有出现「一次补齐」日志');
  check(numberAfter(sackStats, '快重传') >= 1, 'SACK 模式没有触发快重传');
  check(numberAfter(sackStats, 'RTO 超时') === 0, 'SACK 路径上仍然走了 RTO');
  await page.screenshot({ path: path.join(outDir, 'sack.png') });
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`可视化验收失败（${failures.length}）：`);
  failures.forEach(item => console.error(` - ${item}`));
  console.error(`截图见 ${outDir}`);
  process.exit(1);
}
console.log(`可视化验收通过，截图见 ${outDir}`);
