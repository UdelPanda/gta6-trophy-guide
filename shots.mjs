// shots.mjs — screenshot tooling for THE PLATINUM RUN.
// Launches the VM's Chromium under Xvfb (this Chromium refuses plain headless
// flags and demands a Hatch WebGL domain policy at startup), drives it over
// CDP, and captures the four views listed in shots.json as 1280x720 JPEGs in
// screenshots/. Pages load over file:// with --allow-file-access-from-files
// so the app's data fetch works; localhost HTTP is blocked by this build's
// local-network-access checks.
// Usage: node shots.mjs
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const appDir = join(root, 'app');
const outDir = join(root, 'screenshots');
const CDP = 9333;
const CHROME = '/opt/meta-chromium/chrome';
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));

// This Chromium build refuses to start without a Hatch WebGL domain policy:
// write the all-origins policy to a scratch file and pass it with its SHA-256.
const policyPath = '/tmp/platinum-run-webgl-policy.txt';
const policyBody = 'hatch-webgl-all-origins-v1\n';
writeFileSync(policyPath, policyBody);
const policySha = createHash('sha256').update(policyBody).digest('hex');

const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1400x900x24'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const chrome = spawn(CHROME, [
  '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--allow-file-access-from-files',
  `--hatch-webgl-allowed-domains-file=${policyPath}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${CDP}`, '--user-data-dir=/tmp/platinum-run-shots-profile',
  '--window-size=1300,860', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'
], { env: { ...process.env, DISPLAY: ':99' }, stdio: 'ignore' });

async function cdpReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP}/json/version`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('CDP never came up');
}
await cdpReady();

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let seq = 0;
    const pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
      },
      close() { ws.close(); }
    }));
    ws.addEventListener('error', reject);
  });
}

mkdirSync(outDir, { recursive: true });
for (const shot of shots) {
  const target = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: shot.viewport.width, height: shot.viewport.height, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `file://${appDir}/${shot.url}` });
  // wait until the app has rendered its data (55 list rows + sources panel)
  let ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#trophy-list .row').length === 55 && document.querySelectorAll('#sources-panel .src').length === 11`,
      returnByValue: true
    });
    ready = r.result && r.result.result && r.result.result.value === true;
    if (!ready) await new Promise(r => setTimeout(r, 200));
  }
  if (!ready) throw new Error(`app did not render for ${shot.file}`);
  await new Promise(r => setTimeout(r, 350));
  const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: shot.quality ?? 85, captureBeyondViewport: false });
  const buf = Buffer.from(shotRes.result.data, 'base64');
  writeFileSync(join(outDir, shot.file), buf);
  console.log(`${shot.file}: ${buf.length} bytes`);
  await cdp.send('Page.close');
  cdp.close();
}
chrome.kill('SIGKILL');
xvfb.kill('SIGKILL');
process.exit(0);
