// Screenshot tooling for The Platinum Run: drives headless Chromium over CDP,
// loads each view listed in shots.json from the local serve.ts server with its
// demo state in the URL, and writes 1280x720 JPEGs into screenshots/.
// Usage: node serve.ts (in another shell), then `node shots.mjs`.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9333;
// Load the app from file:// (it is a fully offline app): this Chromium build's
// Local Network Access checks block loopback HTTP navigations from CDP.
const BASE = 'file:///home/hatch/workspace/makefun/gta6-trophy-guide/app/index.html';
const MAX_BYTES = 262144;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForEndpoint() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chromium CDP endpoint never came up');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.waiters = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.waiters = this.waiters.filter((w) => {
          if (w.method === msg.method) { w.resolve(msg.params); return false; }
          return true;
        });
      }
    });
  }
  send(method, params = {}) {
    const id = (this.seq += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method) {
    return new Promise((resolve) => this.waiters.push({ method, resolve }));
  }
}

// This Chromium build refuses to start without a Hatch WebGL domain policy:
// a one-line contract file plus its SHA-256, passed as switches.
const policyText = 'hatch-webgl-all-origins-v1\n';
const policyPath = '/tmp/platinum-webgl-policy.txt';
writeFileSync(policyPath, policyText);
const policySha = createHash('sha256').update(policyText).digest('hex');

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--hatch-webgl-allowed-domains-file=${policyPath}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  '--user-data-dir=/tmp/platinum-shots-profile',
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1', '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitForEndpoint();
  // Open the first shot's URL as the initial target: starting from about:blank
  // makes Chromium treat the local page as a public page reaching the LAN.
  const firstUrl = encodeURIComponent(BASE + shots[0].path);
  const created = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${firstUrl}`, { method: 'PUT' })).json();
  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const shot of shots) {
    const { width, height } = shot.viewport;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: BASE + shot.path });
    await loaded;
    // Wait until the app has rendered its trophy list (data fetched + DOM built).
    let rendered = false;
    for (let i = 0; i < 40; i += 1) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: "document.querySelectorAll('#list .row').length",
        returnByValue: true,
      });
      if (r.result && r.result.value > 0) { rendered = true; break; }
      await sleep(250);
    }
    if (!rendered) throw new Error(`App did not render for ${shot.file} (${shot.path})`);
    await sleep(700);
    let quality = 85;
    let buf = null;
    while (quality >= 45) {
      const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, fromSurface: true });
      buf = Buffer.from(shotRes.data, 'base64');
      if (buf.length <= MAX_BYTES) break;
      quality -= 15;
    }
    writeFileSync(join(here, 'screenshots', shot.file), buf);
    console.log(`${shot.file}: ${buf.length} bytes (jpeg quality ${quality})`);
  }
  ws.close();
} finally {
  chrome.kill('SIGTERM');
}
