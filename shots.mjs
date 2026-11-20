// Takes this entry's four screenshots: serves app/ with the kit's serve.ts, renders each view from
// shots.json in headless Chrome (driven over the DevTools protocol), and converts the PNG captures
// to JPEG with ffmpeg, trimming quality until each file is inside the 256 KiB gate limit.
// This machine's Chromium build asks for a WebGL domain policy at startup; the policy written here
// only governs WebGL origins (this app uses no WebGL) and exists so the browser will start at all.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = '/opt/meta-chromium/chrome';
const PORT = 8123;
const CDP_PORT = 9333;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const tmp = join(here, '.shots-tmp');
mkdirSync(tmp, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const policyPath = join(tmp, 'webgl-policy.txt');
writeFileSync(policyPath, 'hatch-webgl-allowed-domains-v1\nexample.com\n');
const policySha = createHash('sha256').update(readFileSync(policyPath)).digest('hex');

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
  `--user-data-dir=${join(tmp, 'profile')}`,  `--remote-debugging-port=${CDP_PORT}`,
  `--hatch-webgl-allowed-domains-file=${policyPath}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  'about:blank',
], { stdio: 'ignore' });

async function waitForJson(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`never came up: ${url}`);
}

// A minimal DevTools-protocol client: just enough to navigate, wait for load and capture a PNG.
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const loadWaiters = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
    if (msg.method === 'Page.loadEventFired') loadWaiters.splice(0).forEach((fn) => fn());
  });
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId;
      nextId += 1;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      ws.send(JSON.stringify({ id, method, params }));
      return result;
    },
    waitForLoad() {
      return new Promise((resolve) => { loadWaiters.push(resolve); setTimeout(resolve, 12000); });
    },
    close() { ws.close(); },
  };
}

async function waitForAppReady(cdp) {
  for (let i = 0; i < 50; i += 1) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: 'location.href.startsWith("http://127.0.0.1") && document.readyState === "complete" && !!document.querySelector("#trophy-list .trophy-row, #view-roadmap .stage-card, #view-missables .miss-card, #view-sources .source-table")',
      returnByValue: true,
    }).catch(() => null);
    if (res && res.result && res.result.value === true) return;
    await sleep(300);
  }
  throw new Error('the app never rendered');
}

async function capturePng(shot, index) {
  // This build's Local Network Access checks refuse a browser-initiated jump straight to the local
  // preview server ("initiated by a public page"), so each shot enters through a tiny local launcher
  // page that redirects to the served app — the app itself is the kit's serve.ts over HTTP, unchanged.
  const target = await (await fetch(`http://localhost:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: shot.viewport.width, height: shot.viewport.height, deviceScaleFactor: 1, mobile: false,
  });
  const goViaLauncher = async (appUrl, name) => {
    const launcher = join(tmp, `go-${index}-${name}.html`);
    writeFileSync(launcher, `<!doctype html><script>location.replace(${JSON.stringify(appUrl)})</script>`);
    await cdp.send('Page.navigate', { url: `file://${launcher}` });
    await waitForAppReady(cdp);
  };
  // Start every shot from a clean browser store so each one shows exactly the state its URL declares.
  await goViaLauncher(`http://127.0.0.1:${PORT}/`, 'reset');
  await cdp.send('Runtime.evaluate', { expression: 'localStorage.clear()' });
  await goViaLauncher(`http://127.0.0.1:${PORT}${shot.path}`, 'shot');
  await sleep(900); // let fonts and scroll positions settle
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  cdp.close();
  await fetch(`http://localhost:${CDP_PORT}/json/close/${target.id}`).catch(() => {});
  const png = join(tmp, shot.file.replace(/\.jpg$/, '.png'));
  writeFileSync(png, Buffer.from(data, 'base64'));
  return png;
}

function convertToJpeg(png, out) {
  // ffmpeg qscale: 2 (best) .. 31 (worst). Walk down until the file fits the 256 KiB cap.
  for (const q of [3, 4, 5, 6, 7, 8]) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', String(q), out]);
    const size = statSync(out).size;
    if (size <= 262144) return { q, size };
  }
  return { q: 8, size: statSync(out).size };
}

try {
  await waitForJson(`http://localhost:${PORT}/`);
  await waitForJson(`http://localhost:${CDP_PORT}/json/version`);
  for (const [index, shot] of shots.entries()) {
    const out = join(here, 'screenshots', shot.file);
    const png = await capturePng(shot, index);
    const { q, size } = convertToJpeg(png, out);
    const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out]).toString().trim();
    console.log(`${shot.file}: ${dims}, ${(size / 1024).toFixed(1)} KiB, ffmpeg q=${q}`);
    if (size > 262144) throw new Error(`${shot.file} is over the 256 KiB cap`);
  }
} finally {
  chrome.kill();
  server.kill();
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
}
