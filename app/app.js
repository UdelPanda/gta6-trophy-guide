// The Platinum Run — GTA VI Trophy Guide & Tracker.
// Offline tracker logic: earned ticks and counters persist in localStorage,
// guides render from data/trophies.json, and every step keeps its citations.
const LS_KEY = 'platinum-run-progress-v1';
const data = await (await fetch('data/trophies.json')).json();
const TROPHIES = data.trophies;
const SOURCES = data.sources;
const byId = new Map(TROPHIES.map((t) => [t.id, t]));
const srcByN = new Map(SOURCES.map((s) => [s.n, s]));

const KINDS = [
  ['all', 'All'], ['story', 'Story'], ['missable', 'Missable'], ['collectibles', 'Collectibles'],
  ['activities', 'Activities'], ['side', 'Side'], ['crime', 'Crime'], ['world', 'World'],
  ['money', 'Money'], ['completion', 'Completion'],
];
const GRADES = [['all', 'All grades'], ['platinum', 'Platinum'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];
const STAGES = [
  { n: 1, title: 'Opening & Chapter 1', note: 'Start clean: a manual save at the chapter start, the Chapter 1 balcony meditation at Jason\u2019s house done early, and first meetings with Cal and Kenton. Quick trophies — and the run\u2019s only real trap lives here.' },
  { n: 2, title: 'Chapters 2\u20133', note: 'The state opens up: partner play after Coffee Break, the quest givers (Andy, Billy, Randy, Tyrone, Bret), garages, Scooter Bros registrations and the first partner crimes.' },
  { n: 3, title: 'Chapter 4 + finale', note: 'Finish the story set, unlock the bank vaults in Chapter 4 and close out the campaign.', ponr: 'POINT OF NO RETURN — the finale ends the story. Nothing else on this list is missable, but the Chapter 1 meditation (stage 1) must already be done, and keep a manual save from before the final mission.' },
  { n: 4, title: 'Endgame & 100%', note: 'With the story done, the 100% Completion checklist appears under Progress > Stats. Most of the platinum run lives in this stage.' },
  { n: 5, title: 'Collectibles', note: 'Card sets, WAiNK scans and vehicle discoveries — the slow, scenic grind. Scan everything new as you pass it and these fill themselves.' },
  { n: 6, title: 'Grinds & counters', note: 'Stunts, races, range golds, challenges and the big counters. Leave these late: half of them complete naturally while you do everything else.' },
  { n: 7, title: 'Platinum', note: 'The one-offs and secrets saved for last — the jet, the tank, the UFO, the cocktail — and then the platinum itself.' },
];

const params = new URLSearchParams(location.search);
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } },
  set(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const saved = store.get();
const state = {
  earned: new Set(Array.isArray(saved.earned) ? saved.earned : []),
  counts: (saved.counts && typeof saved.counts === 'object') ? saved.counts : {},
  spoilers: !!saved.spoilers,
  kind: 'all', grade: 'all', sort: 'id', q: '', unearnedOnly: false,
  open: 35, view: 'checklist',
};
if (params.get('earned')) {
  state.earned = new Set(params.get('earned').split(',').map((x) => parseInt(x, 10)).filter((x) => byId.has(x)));
}
if (params.get('counts')) {
  for (const pair of params.get('counts').split(',')) {
    const [id, n] = pair.split(':').map((x) => parseInt(x, 10));
    if (byId.has(id) && Number.isFinite(n)) state.counts[id] = n;
  }
}
if (params.get('open')) { const o = parseInt(params.get('open'), 10); if (byId.has(o)) state.open = o; }
if (params.get('spoilers')) state.spoilers = params.get('spoilers') === '1';
if (params.get('view')) state.view = params.get('view');
if (params.has('compact')) document.body.classList.add('compact');

function persist() {
  store.set({ earned: [...state.earned], counts: state.counts, spoilers: state.spoilers });
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const fmt = (n) => n.toLocaleString('en-US');
const pct = (v) => `${v.toFixed(2)}%`;
const isStory = (t) => t.kinds.includes('story');
const isHidden = (t) => state.spoilers && isStory(t) && !state.earned.has(t.id);
const dispName = (t) => (isHidden(t) ? 'Hidden story trophy' : t.name);
const dispDesc = (t) => (isHidden(t) ? 'Spoiler hidden — earn it to reveal the official description.' : t.description);

// Citation statistics: which trophies cite each source, and how many steps.
const citedBy = new Map(SOURCES.map((s) => [s.n, new Set()]));
let totalSteps = 0; let citedSteps = 0;
for (const t of TROPHIES) {
  for (const s of t.steps) {
    totalSteps += 1;
    if (s.cites.length) citedSteps += 1;
    for (const c of s.cites) if (citedBy.has(c)) citedBy.get(c).add(t.id);
  }
}
const guidesCited = TROPHIES.filter((t) => t.steps.some((s) => s.cites.length)).length;

const $ = (id) => document.getElementById(id);

function renderHeader() {
  const pts = TROPHIES.filter((t) => state.earned.has(t.id)).reduce((a, t) => a + t.points, 0);
  $('statEarned').textContent = `${state.earned.size} / ${TROPHIES.length}`;
  $('statPoints').textContent = `${fmt(pts)} pts`;
  $('statPlat').textContent = pct(byId.get(1).rarityLive);
  $('chkSpoiler').checked = state.spoilers;
}

function renderAudit() {
  const g = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (const t of TROPHIES) g[t.grade] += 1;
  const hidden = TROPHIES.filter((t) => t.secret).length;
  const counters = TROPHIES.filter((t) => t.counter).length;
  const miss = TROPHIES.filter((t) => t.missable).length;
  const items = [
    `<b>${TROPHIES.length}</b> official trophies`,
    `<b>${g.platinum}P ${g.gold}G ${g.silver}S ${g.bronze}B</b>`,
    `<b>${hidden}</b> hidden`,
    `<b>${guidesCited}/${TROPHIES.length}</b> guides cite a source`,
    `<b>${citedSteps}/${totalSteps}</b> steps cited`,
    `<b>${counters}</b> trophies with live counters`,
    `<span class="warn">${miss} possibly missable</span>`,
    `<b>${SOURCES.length}</b> sources read 20 Nov 2026`,
    `live rarity on all ${TROPHIES.length} from Exophase [2]`,
  ];
  $('audit').innerHTML = items.join('<span>·</span> ');
}

function renderChips() {
  const kc = $('kindChips'); kc.replaceChildren();
  for (const [key, label] of KINDS) {
    const n = key === 'all' ? TROPHIES.length : TROPHIES.filter((t) => t.kinds.includes(key)).length;
    const b = el('button', 'chip' + (state.kind === key ? ' on' : ''));
    b.type = 'button';
    b.append(`${label} `, el('span', 'n', String(n)));
    b.addEventListener('click', () => { state.kind = key; renderAll(); });
    kc.append(b);
  }
  const gc = $('gradeChips'); gc.replaceChildren();
  for (const [key, label] of GRADES) {
    const b = el('button', 'chip' + (state.grade === key ? ' on' : ''), label);
    b.type = 'button';
    b.addEventListener('click', () => { state.grade = key; renderAll(); });
    gc.append(b);
  }
}

function visibleTrophies() {
  let list = TROPHIES.filter((t) =>
    (state.kind === 'all' || t.kinds.includes(state.kind)) &&
    (state.grade === 'all' || t.grade === state.grade) &&
    (!state.unearnedOnly || !state.earned.has(t.id)) &&
    (!state.q || `${t.name} ${t.description} ${t.summary} ${t.kinds.join(' ')}`.toLowerCase().includes(state.q)));
  const sorters = {
    id: (a, b) => a.id - b.id,
    rarityAsc: (a, b) => a.rarityLive - b.rarityLive,
    rarityDesc: (a, b) => b.rarityLive - a.rarityLive,
    pointsDesc: (a, b) => b.points - a.points,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return list.sort(sorters[state.sort] || sorters.id);
}

function renderList() {
  const wrap = $('list');
  const scroll = wrap.scrollTop;
  wrap.replaceChildren();
  const list = visibleTrophies();
  $('listCount').textContent = `Showing ${list.length} of ${TROPHIES.length} trophies`;
  for (const t of list) {
    const row = el('button', 'row' + (state.open === t.id ? ' open' : '') + (state.earned.has(t.id) ? ' done' : ''));
    row.type = 'button';
    const box = el('input'); box.type = 'checkbox'; box.checked = state.earned.has(t.id);
    box.setAttribute('aria-label', `Mark ${t.name} earned`);
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => { toggleEarned(t.id, box.checked); });
    const mid = el('span');
    mid.append(el('span', 'rname', dispName(t)), el('span', 'rdesc', dispDesc(t)));
    const meta = el('span', 'rmeta');
    meta.append(el('span', `badge b-${t.grade}`, t.grade));
    for (const k of t.kinds.slice(0, 2)) meta.append(el('span', 'kindtag', k));
    if (t.secret) meta.append(el('span', 'kindtag', 'hidden'));
    mid.append(meta);
    const rar = el('span', 'rarity');
    rar.append(el('b', null, pct(t.rarityLive)), el('small', null, 'live rarity'));
    row.append(box, mid, rar);
    row.addEventListener('click', () => { state.open = t.id; renderAll(); });
    wrap.append(row);
  }
  wrap.scrollTop = scroll;
}

function toggleEarned(id, on) {
  if (on) state.earned.add(id); else state.earned.delete(id);
  persist(); renderAll();
}

function citesLine(t) {
  const used = [...new Set(t.steps.flatMap((s) => s.cites))].sort((a, b) => a - b);
  return used.map((n) => `[${n}] ${srcByN.get(n).name}`).join(' · ');
}

function renderDetail() {
  const t = byId.get(state.open);
  const d = $('detail'); d.replaceChildren();
  const head = el('div', 'd-head');
  head.append(el('h2', null, dispName(t)));
  const earnLab = el('label', 'earn');
  const box = el('input'); box.type = 'checkbox'; box.checked = state.earned.has(t.id);
  box.addEventListener('change', () => toggleEarned(t.id, box.checked));
  earnLab.append(box, document.createTextNode(' Earned'));
  head.append(earnLab);
  d.append(head);

  const off = el('div', 'official');
  off.append(el('small', null, 'Official description'), el('p', null, `\u201C${dispDesc(t)}\u201D`));
  d.append(off);

  const meta = el('div', 'd-meta');
  const stage = STAGES[t.stage - 1];
  meta.innerHTML = `<span>Grade <b>${t.grade}</b></span><span><b>${t.points}</b> PSN points</span>` +
    `<span>Roadmap <b>Stage ${t.stage} — ${stage.title}</b></span>` +
    `<span>${t.secret ? '<b>Hidden</b> on PSN until earned' : 'Visible on PSN'}</span>` +
    `<span>Trophy <b>#${t.id}</b> of ${TROPHIES.length}</span>`;
  d.append(meta);

  const rl = el('p', 'rarityline');
  rl.innerHTML = `Live rarity <b>${pct(t.rarityLive)}</b> of players have earned this · launch night ${pct(t.rarityLaunch)} · earn rates from Exophase [2], read live 20 Nov 2026`;
  d.append(rl);

  if (t.missable && t.missableNote) {
    const c = el('div', 'callout miss');
    c.append(el('b', 't', 'Possibly missable — read before you play on'), el('span', null, t.missableNote));
    d.append(c);
  }

  const secS = el('div', 'd-sec');
  secS.append(el('h3', null, 'In short'), el('p', null, t.summary));
  d.append(secS);

  const sec = el('div', 'd-sec');
  sec.append(el('h3', null, 'How to earn it — step by step'));
  const ol = el('ol', 'steps');
  for (const s of t.steps) {
    const li = el('li');
    li.append(document.createTextNode(s.text + ' '));
    li.append(el('span', 'cite', s.cites.map((c) => `[${c}]`).join(' ')));
    ol.append(li);
  }
  sec.append(ol);
  d.append(sec);

  if (t.counter) {
    const cur = Math.min(state.counts[t.id] || 0, t.counter.target);
    const cb = el('div', 'counterbox');
    cb.append(el('div', 'clabel', `${t.counter.label} — your live counter`));
    const row = el('div', 'crow');
    const minus = el('button', null, '\u2212'); minus.type = 'button';
    const plus = el('button', null, '+'); plus.type = 'button';
    const num = el('span', 'cnum', fmt(cur));
    minus.addEventListener('click', () => setCount(t, cur - 1));
    plus.addEventListener('click', () => setCount(t, cur + 1));
    row.append(minus, num, plus, el('span', 'ctarget', `/ ${fmt(t.counter.target)}`));
    cb.append(row);
    const bar = el('div', 'bar');
    const fill = el('i'); fill.style.width = `${Math.round((cur / t.counter.target) * 100)}%`;
    bar.append(fill); cb.append(bar);
    d.append(cb);
  }

  if (t.disagree) {
    const c = el('div', 'callout dis');
    c.append(el('b', 't', 'Sources disagree'), el('span', null, t.disagree));
    d.append(c);
  }

  d.append(el('p', 'srcfor', `Sources for this guide: ${citesLine(t)}`));
}

function setCount(t, n) {
  const v = Math.max(0, Math.min(n, t.counter.target));
  state.counts[t.id] = v;
  if (v >= t.counter.target) state.earned.add(t.id);
  else if (state.earned.has(t.id) && (state.counts[t.id] || 0) < t.counter.target) state.earned.delete(t.id);
  persist(); renderAll();
}

function renderSourcesPanel() {
  const p = $('srcPanel'); p.replaceChildren();
  for (const s of SOURCES) {
    const item = el('div', 'srcitem');
    item.append(el('span', 'sn', `[${s.n}] `), el('span', 'sname', s.name));
    item.append(el('span', 'surl', s.url));
    const cited = citedBy.get(s.n).size;
    item.append(el('div', 'smeta', s.n === 2
      ? `Read ${s.read} · backs the live rarity on all ${TROPHIES.length} trophies`
      : `Read ${s.read} · cited by ${cited} of ${TROPHIES.length} guides`));
    p.append(item);
  }
}

function openFromElsewhere(id) {
  state.open = id; state.view = 'checklist'; renderAll();
  document.querySelector('.col-detail').scrollIntoView({ block: 'start' });
}

function renderRoadmap() {
  const v = $('view-roadmap'); v.replaceChildren();
  const save = el('div', 'savebox');
  save.innerHTML = '<b>Save hygiene:</b> the game gives you 15 manual save slots plus 1 autosave, and there is no mission replay. ' +
    'Save at the start and end of every chapter and before the final mission, and rotate the slots so a bad outcome can always be reloaded. ' +
    'Never use cheat codes on a trophy run — cheats disable trophies and saving for that session.';
  v.append(save);
  for (const st of STAGES) {
    const ts = TROPHIES.filter((t) => t.stage === st.n);
    const done = ts.filter((t) => state.earned.has(t.id));
    const pts = ts.reduce((a, t) => a + t.points, 0);
    const dpts = done.reduce((a, t) => a + t.points, 0);
    const box = el('div', 'stage');
    box.append(el('h3', null, `Stage ${st.n} — ${st.title}`));
    box.append(el('div', 'smeta', `${done.length}/${ts.length} earned · ${fmt(dpts)}/${fmt(pts)} pts`));
    if (st.ponr) box.append(el('div', 'ponr', st.ponr));
    box.append(el('p', 'snote', st.note));
    const chips = el('div', 'tchips');
    for (const t of ts) {
      const c = el('button', 'tchip' + (state.earned.has(t.id) ? ' done' : '') + (t.missable ? ' miss' : ''), `${dispName(t)} · ${t.points}`);
      c.type = 'button';
      c.addEventListener('click', () => openFromElsewhere(t.id));
      chips.append(c);
    }
    box.append(chips);
    v.append(box);
  }
}

function renderMissables() {
  const v = $('view-missables'); v.replaceChildren();
  const t = byId.get(28);
  v.append(el('h2', null, 'Missables — one real trap, everything else checked'));
  const intro = el('p', null, 'We checked every trophy on the list against the guides. Exactly one can be locked away by playing on: Positive Mental Attitude, and only because of a single Chapter 1 moment. Everything else can be finished in free roam after the credits.');
  intro.style.maxWidth = '900px';
  v.append(intro);
  const c = el('div', 'callout miss');
  c.append(el('b', 't', `Possibly missable — ${t.name} (trophy #${t.id})`));
  c.append(el('p', null, t.missableNote));
  const ol = el('ol', 'steps');
  for (const s of t.steps) {
    const li = el('li');
    li.append(document.createTextNode(s.text + ' '), el('span', 'cite', s.cites.map((x) => `[${x}]`).join(' ')));
    ol.append(li);
  }
  c.append(ol);
  if (t.disagree) {
    const dis = el('p'); dis.style.marginTop = '8px';
    dis.append(el('b', null, 'Sources disagree: '), document.createTextNode(t.disagree));
    c.append(dis);
  }
  const open = el('button', null, 'Open the full guide'); open.type = 'button';
  open.addEventListener('click', () => openFromElsewhere(28));
  c.append(open);
  v.append(c);

  v.append(el('h3', null, 'Checked and safe — you cannot lock yourself out of these'));
  const ul = el('ul', 'safe-list');
  const safe = [
    'All 12 story trophies: they are awarded automatically as missions complete, with no optional objectives attached [1].',
    'Andy, Billy, Randy and Tyrone questlines: every quest giver stays available after the story ends [1].',
    'Kenton\u2019s treasures: he goes quiet after Chapter 1 but texts Jason again during Chapters 2\u20133 to resume the line [1].',
    'Kingpin Bowling valuables: the operation respawns, so anything missed can be collected on a later visit [1][9].',
    'The expiring \u201Chourglass\u201D optional missions: they gate no trophy at all [1].',
    'The whole 100% Completion checklist: nothing on it is missable; it can all be finished after the credits [1][9].',
    'Every other meditation spot: only the Chapter 1 house balcony is time-limited; the rest stay on the map [1].',
    'Strangers & Freaks strands: strangers are not required for 100% and remain in free roam [1][9].',
  ];
  for (const s of safe) ul.append(el('li', null, s));
  v.append(ul);
}

function renderSourcesView() {
  const v = $('view-sources'); v.replaceChildren();
  v.append(el('h2', null, 'Sources & method'));
  const p1 = el('p', null, 'Every guide in this app is written in our own words from the sources below — no guide text is copied. Trophy names, descriptions and grades are the official PlayStation ones, taken from the published list. Earn-rate (rarity) figures are the live rates published by Exophase [2], read live on 20 Nov 2026; the launch-night figures are the rates recorded on launch night for comparison.');
  p1.style.maxWidth = '900px';
  v.append(p1);
  const p2 = el('p', null, 'A step only carries a citation where that source states the step\u2019s fact. Where sources disagree — the meditation count, the Shooting Range layout, two unconfirmed triggers — the guide shows both positions instead of picking one silently. Two trophies (Bad Luck, I Guess and The Truth Is Out There) still have unconfirmed triggers in every source; their guides say so plainly and give the best documented lead.');
  p2.style.maxWidth = '900px';
  v.append(p2);
  const table = el('table', 'srctable');
  const thead = el('tr');
  for (const h of ['#', 'Source', 'URL', 'Read', 'Cited by']) thead.append(el('th', null, h));
  table.append(thead);
  for (const s of SOURCES) {
    const tr = el('tr');
    tr.append(el('td', null, `[${s.n}]`), el('td', null, s.name), el('td', 'u', s.url), el('td', null, s.read));
    tr.append(el('td', null, s.n === 2 ? `rarity on all ${TROPHIES.length}` : `${citedBy.get(s.n).size} of ${TROPHIES.length} guides`));
    table.append(tr);
  }
  v.append(table);
}

function renderTabs() {
  for (const b of document.querySelectorAll('.tab')) {
    b.classList.toggle('active', b.dataset.view === state.view);
  }
  for (const name of ['checklist', 'roadmap', 'missables', 'sources']) {
    $(`view-${name}`).classList.toggle('hidden', state.view !== name);
  }
}

function renderAll() {
  renderHeader(); renderAudit(); renderChips(); renderList(); renderDetail();
  renderSourcesPanel(); renderRoadmap(); renderMissables(); renderSourcesView(); renderTabs();
}

for (const b of document.querySelectorAll('.tab')) {
  b.addEventListener('click', () => { state.view = b.dataset.view; renderAll(); });
}
$('btnExport').addEventListener('click', () => {
  const payload = JSON.stringify({ app: 'the-platinum-run', version: 1, earned: [...state.earned], counts: state.counts, spoilers: state.spoilers }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  a.download = 'platinum-run-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('fileImport').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const parsed = JSON.parse(await f.text());
    const arr = Array.isArray(parsed) ? parsed : parsed.earned;
    if (Array.isArray(arr)) {
      state.earned = new Set(arr.map((x) => (typeof x === 'number' ? x : (TROPHIES.find((t) => t.name === x) || {}).id)).filter((x) => byId.has(x)));
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.counts && typeof parsed.counts === 'object') state.counts = parsed.counts;
      if (typeof parsed.spoilers === 'boolean') state.spoilers = parsed.spoilers;
    }
    persist(); renderAll();
  } catch { /* unreadable file: keep current progress */ }
  e.target.value = '';
});
$('chkSpoiler').addEventListener('change', () => { state.spoilers = $('chkSpoiler').checked; persist(); renderAll(); });
$('selSort').addEventListener('change', () => { state.sort = $('selSort').value; renderAll(); });
$('inpSearch').addEventListener('input', () => { state.q = $('inpSearch').value.trim().toLowerCase(); renderList(); });
$('chkUnearned').addEventListener('change', () => { state.unearnedOnly = $('chkUnearned').checked; renderList(); });

renderAll();
