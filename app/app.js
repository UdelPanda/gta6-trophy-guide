// THE PLATINUM RUN — GTA VI Trophy Guide & Tracker.
// Offline static app: loads data/trophies.json once, keeps tracker state in
// localStorage, and renders four views (Checklist, Roadmap, Missables, Sources).
// URL params can seed a demo state for screenshots:
//   ?view=roadmap&open=28&earned=2,3,4&counts=28:12&spoilers=show

const STORE_KEY = 'platinum-run-progress-v1';
const KIND_LABELS = {
  story: 'Story', missable: 'Missable', collectibles: 'Collectibles',
  activities: 'Activities', side: 'Side', crime: 'Crime', world: 'World',
  money: 'Money', completion: 'Completion'
};
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const STAGES = [
  { n: 1, title: 'Opening & Chapter 1', time: 'story begins',
    text: 'Play the opening and Chapter 1. Before the chapter ends, do the balcony meditation at Jason\u2019s house with Lucia \u2014 it feeds the one possibly-missable trophy. Scan vehicles and study animals as you travel; all of it counts later.' },
  { n: 2, title: 'Chapters 2\u20133', time: 'partner play opens',
    text: 'Partner switching opens after Breakfast Run, and Kenton\u2019s quest line resumes during these chapters. Chapter 3 brings the Snap Gun through Yasmani\u2019s Jewelry Jobs and the Key Cloner for Randy\u2019s Wish List.' },
  { n: 3, title: 'Chapter 4 + the finale \u2014 POINT OF NO RETURN', time: 'save first',
    text: 'Late in Chapter 4 the optional mission That\u2019s Where The Money Is\u2026 unlocks the bank vaults. Bank a manual save before the final mission: there is no mission replay, so that save is your only way back.' },
  { n: 4, title: 'Endgame & 100%', time: '\u2248100 hours',
    text: 'The 100% checklist appears at Progress > Stats > 100% Completion after the credits, and everything you did during the story already counts. Nothing on it is missable, so work it calmly in free roam.' },
  { n: 5, title: 'Collectibles & quest lines', time: 'cleanup',
    text: 'Card sets, WAiNK scans, stranger strands and the character quest lines \u2014 Andy, Kenton, Billy, Randy, Tyrone and Bret. The named quest-givers\u2019 strands have their own trophies and do not count toward Strangers & Freaks.' },
  { n: 6, title: 'Grinds & counters', time: 'the long counts',
    text: 'The big numbers: 250 stunts, 42 Shooting Range golds, 100 vehicles, 50 challenges, $250,000 laundered, $100,000 spent. Every one of these trophies carries a working counter in its guide \u2014 track them here as you play.' },
  { n: 7, title: 'Platinum', time: '\u2248200 hours total',
    text: 'When the other 54 trophies are in, Vice Got a Price! pops on its own. Guides rate the run 4/10 difficulty at roughly 200 hours \u2014 the checklist, not the skill, is the wall.' }
];

const doc = await (await fetch('data/trophies.json')).json();
const TROPHIES = doc.trophies;
const SOURCES = doc.sources;
const byId = new Map(TROPHIES.map(t => [t.id, t]));

// ---- cited-by counts: trophies whose steps cite the source; Exophase [2]
// backs the rarity line printed on all 55 guides instead of steps.
const citedBy = new Map(SOURCES.map(s => [s.n, 0]));
for (const t of TROPHIES) {
  const used = new Set();
  for (const st of t.steps) for (const c of st.cites) used.add(c);
  for (const c of used) citedBy.set(c, (citedBy.get(c) || 0) + 1);
}
citedBy.set(2, TROPHIES.length);
const totalSteps = TROPHIES.reduce((a, t) => a + t.steps.length, 0);

// ---- state -------------------------------------------------------------
function blankState() { return { earned: [], counts: {}, spoilers: true }; }
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blankState();
    const s = JSON.parse(raw);
    return { earned: s.earned || [], counts: s.counts || {}, spoilers: s.spoilers !== false };
  } catch { return blankState(); }
}
const params = new URLSearchParams(location.search);
const state = loadState();
if (params.has('earned')) state.earned = params.get('earned').split(',').map(Number).filter(n => byId.has(n));
if (params.has('counts')) {
  for (const pair of params.get('counts').split(',')) {
    const [id, v] = pair.split(':').map(Number);
    if (byId.has(id)) state.counts[id] = v;
  }
}
if (params.has('spoilers')) state.spoilers = params.get('spoilers') !== 'hide';
let earned = new Set(state.earned);
let openId = Number(params.get('open')) || 28;
if (!byId.has(openId)) openId = TROPHIES[0].id;
let kindFilter = 'all', gradeFilter = 'all', sortMode = 'official', query = '';

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    earned: [...earned], counts: state.counts, spoilers: state.spoilers
  }));
}
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtPct = v => (v === 100 ? '100' : String(v)) + '%';
const fmtNum = v => v.toLocaleString('en-US');
function isMasked(t) { return !state.spoilers && t.secret && !earned.has(t.id); }
function citesHtml(cites) { return cites.map(c => `<span class="cite">[${c}]</span>`).join(' '); }

// ---- header / audit ------------------------------------------------------
function renderHeader() {
  const pts = TROPHIES.filter(t => earned.has(t.id)).reduce((a, t) => a + t.points, 0);
  $('stat-earned').textContent = `${earned.size} / 55`;
  $('stat-points').textContent = fmtNum(pts);
  $('stat-plat').textContent = fmtPct(byId.get(1).rarityLive);
  $('chk-spoilers').checked = state.spoilers;
}
$('audit-steps').textContent = `${totalSteps} STEPS`;

// ---- checklist: filters --------------------------------------------------
function buildChips() {
  const kc = $('kind-chips'); kc.replaceChildren();
  const kinds = [['all', TROPHIES.length]];
  for (const k of Object.keys(KIND_LABELS)) {
    const n = TROPHIES.filter(t => t.kinds.includes(k)).length;
    if (n) kinds.push([k, n]);
  }
  for (const [k, n] of kinds) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (kindFilter === k ? ' on' : '');
    b.innerHTML = `${k === 'all' ? 'All' : KIND_LABELS[k]} <span class="n">${n}</span>`;
    b.addEventListener('click', () => { kindFilter = k; buildChips(); renderList(); });
    kc.append(b);
  }
  const gc = $('grade-chips'); gc.replaceChildren();
  const grades = [['all', TROPHIES.length], ['platinum', 1], ['gold', 2], ['silver', 6], ['bronze', 46]];
  for (const [g, n] of grades) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (gradeFilter === g ? ' on' : '');
    b.innerHTML = `${g === 'all' ? 'All grades' : g[0].toUpperCase() + g.slice(1)} <span class="n">${n}</span>`;
    b.addEventListener('click', () => { gradeFilter = g; buildChips(); renderList(); });
    gc.append(b);
  }
}

function visibleTrophies() {
  let list = TROPHIES.filter(t =>
    (kindFilter === 'all' || t.kinds.includes(kindFilter)) &&
    (gradeFilter === 'all' || t.grade === gradeFilter) &&
    (!query || t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)));
  if (sortMode === 'rarest') list = [...list].sort((a, b) => a.rarityLive - b.rarityLive);
  if (sortMode === 'common') list = [...list].sort((a, b) => b.rarityLive - a.rarityLive);
  if (sortMode === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sortMode === 'grade') list = [...list].sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id);
  return list;
}

function renderList() {
  const wrap = $('trophy-list'); wrap.replaceChildren();
  const list = visibleTrophies();
  if (!list.length) {
    const d = document.createElement('div');
    d.className = 'list-empty'; d.textContent = 'No trophies match those filters.';
    wrap.append(d); return;
  }
  for (const t of list) {
    const row = document.createElement('div');
    row.className = 'row' + (t.id === openId ? ' open' : '') + (earned.has(t.id) ? ' earned' : '') + (isMasked(t) ? ' masked' : '');
    row.dataset.id = t.id;
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = earned.has(t.id);
    box.setAttribute('aria-label', `Mark ${t.name} earned`);
    box.addEventListener('click', e => e.stopPropagation());
    box.addEventListener('change', () => { toggleEarned(t.id, box.checked); });
    const dot = document.createElement('span'); dot.className = 'dot ' + t.grade;
    const main = document.createElement('div');
    const masked = isMasked(t);
    main.innerHTML = `<div class="rname">${masked ? 'Hidden Trophy' : esc(t.name)}${t.missable ? '<span class="miss">MISSABLE?</span>' : ''}</div>
      <div class="rmeta">${t.kinds.map(k => KIND_LABELS[k]).join(' · ')} · Stage ${t.stage}${t.secret ? ' · Hidden' : ''}</div>`;
    const rar = document.createElement('div');
    rar.className = 'rar';
    rar.innerHTML = `${fmtPct(t.rarityLive)}<small>LIVE [2]</small>`;
    row.append(box, dot, main, rar);
    row.addEventListener('click', () => { openId = t.id; renderList(); renderDetail(); });
    wrap.append(row);
  }
  const open = wrap.querySelector('.row.open');
  if (open) wrap.scrollTop = Math.max(0, open.offsetTop - wrap.offsetTop - 118);
}

function toggleEarned(id, on) {
  if (on) earned.add(id); else earned.delete(id);
  save(); renderHeader(); renderList(); renderDetail(); renderRoadmap(); renderMissables();
}

// ---- checklist: detail ---------------------------------------------------
function detailHtml(t) {
  const masked = isMasked(t);
  const name = masked ? 'Hidden Trophy' : t.name;
  const desc = masked ? 'Hidden until earned \u2014 or turn on \u201cShow spoilers\u201d above.' : t.description;
  const tags = [
    ...t.kinds.map(k => `<span class="tag">${KIND_LABELS[k]}</span>`),
    `<span class="tag">Roadmap stage ${t.stage}</span>`,
    t.secret ? '<span class="tag">Hidden trophy</span>' : '',
    t.missable ? '<span class="tag miss">POSSIBLY MISSABLE</span>' : ''
  ].join('');
  const steps = masked ? '' : `<ol class="steps">${t.steps.map(s =>
    `<li>${esc(s.text)} ${citesHtml(s.cites)}</li>`).join('')}</ol>`;
  const counter = (!masked && t.counter) ? `
    <div class="counter-widget">
      <div class="counter-top"><span class="counter-label">COUNTER \u2014 ${esc(t.counter.label).toUpperCase()}</span>
      <span class="counter-value">${fmtNum(state.counts[t.id] || 0)} <small>/ ${fmtNum(t.counter.target)}</small></span></div>
      <div class="counter-bar"><div class="counter-fill" style="width:${Math.min(100, 100 * (state.counts[t.id] || 0) / t.counter.target)}%"></div></div>
      <div class="counter-btns">
        <button type="button" data-cnt="-1" data-id="${t.id}">\u2212</button>
        <button type="button" data-cnt="1" data-id="${t.id}">+</button>
        <button type="button" class="reset" data-cnt="reset" data-id="${t.id}">Reset</button>
      </div>
    </div>` : '';
  const calloutsOf = type => masked ? '' : (t.callouts || []).filter(c => c.type === type).map(c => `
    <div class="callout ${c.type}"><h4>${esc(c.title).toUpperCase()}</h4><p>${esc(c.text)}</p></div>`).join('');
  const warnCallouts = calloutsOf('warn');
  const otherCallouts = (t.callouts || []).filter(c => c.type !== 'warn').map(c => masked ? '' : `
    <div class="callout ${c.type}"><h4>${esc(c.title).toUpperCase()}</h4><p>${esc(c.text)}</p></div>`).join('');
  return `
    <div class="detail-head"><h2>${esc(name)}</h2>
      <span class="grade-badge ${t.grade}">${t.grade.toUpperCase()} \u00b7 ${t.points} PTS</span></div>
    <div class="detail-tags">${tags}</div>
    <p class="official-label">OFFICIAL DESCRIPTION</p>
    <p class="official-desc">${esc(desc)}</p>
    <div class="rarity-line">LIVE RARITY ${fmtPct(t.rarityLive)} of players have earned this <span class="cite">[2]</span>
      <span class="dim">\u00b7 launch ${fmtPct(t.rarityLaunch)} \u00b7 Exophase, 20 Nov 2026</span></div>
    ${masked ? '' : `<p class="summary">${esc(t.summary)}</p>`}
    ${counter}${warnCallouts}${steps}${otherCallouts}
    <label class="earn-toggle"><input type="checkbox" data-earn="${t.id}" ${earned.has(t.id) ? 'checked' : ''}> Earned \u2014 tick it off</label>`;
}
function renderDetail() { $('detail').innerHTML = detailHtml(byId.get(openId)); wireDetail($('detail')); }
function wireDetail(root) {
  root.querySelectorAll('[data-cnt]').forEach(b => b.addEventListener('click', () => {
    const id = Number(b.dataset.id);
    const t = byId.get(id);
    if (b.dataset.cnt === 'reset') state.counts[id] = 0;
    else state.counts[id] = Math.max(0, Math.min(t.counter.target, (state.counts[id] || 0) + Number(b.dataset.cnt)));
    save(); renderDetail(); renderMissables();
  }));
  root.querySelectorAll('[data-earn]').forEach(c => c.addEventListener('change', () => toggleEarned(Number(c.dataset.earn), c.checked)));
}

// ---- sources panel ---------------------------------------------------------
function sourcesPanelHtml() {
  const rows = SOURCES.map(s => `
    <div class="src">
      <div class="sname"><span class="n">[${s.n}]</span> ${esc(s.name.split(' \u2014 ')[0])}</div>
      <div class="surl">${esc(s.url)}</div>
      <div class="smeta">${s.n === 2 ? `rarity on ${citedBy.get(2)} of 55 guides` : `cited by ${citedBy.get(s.n)} of 55 guides`} \u00b7 read ${s.read}</div>
    </div>`).join('');
  return `<h3>SOURCES \u2014 EVERY STEP CITES THESE</h3>
    <p class="sub">Guides are our own words; a step is only cited where the source states its fact. Rarity is Exophase [2], read live 20 Nov 2026.</p>${rows}`;
}
$('sources-panel').innerHTML = sourcesPanelHtml();

// ---- roadmap ---------------------------------------------------------------
function renderRoadmap() {
  const wrap = $('roadmap'); wrap.replaceChildren();
  const note = document.createElement('div');
  note.className = 'road-note';
  note.innerHTML = `<h4>SAVE HYGIENE \u2014 READ BEFORE STAGE 1</h4>
    <p>Use the manual saves: you have <strong>15 manual save slots plus an autosave</strong>. Keep a save at the start and end of each chapter (10 saves) and rotate the remaining five. <span class="cite">[1]</span> <span class="cite">[9]</span></p>
    <p><strong>Cheats disable trophies and saving</strong> \u2014 never use them on your trophy save. <span class="cite">[9]</span> <span class="cite">[11]</span>
    One playthrough is enough: no difficulty settings, no mission replay, free roam after the story. <span class="cite">[6]</span> <span class="cite">[9]</span></p>
    <p><strong>The one trap:</strong> the balcony meditation at Jason\u2019s house (Positive Mental Attitude) exists only in Chapter 1 \u2014 see the Missables tab. <span class="cite">[1]</span> <span class="cite">[3]</span></p>`;
  wrap.append(note);
  for (const st of STAGES) {
    const ts = TROPHIES.filter(t => t.stage === st.n);
    const got = ts.filter(t => earned.has(t.id));
    const pts = ts.reduce((a, t) => a + t.points, 0);
    const card = document.createElement('div');
    card.className = 'stage-card';
    card.innerHTML = `<div class="stage-head"><span class="stage-num">STAGE ${st.n}</span>
      <h3>${esc(st.title)}</h3>
      <span class="stage-meta">${got.length}/${ts.length} earned \u00b7 ${fmtNum(pts)} pts \u00b7 ${esc(st.time)}</span></div>
      <p>${esc(st.text)}</p>
      <div class="stage-chips">${ts.map(t =>
        `<button type="button" class="tchip${earned.has(t.id) ? ' done' : ''}" data-jump="${t.id}">${earned.has(t.id) ? '\u2713 ' : ''}${esc(isMasked(t) ? 'Hidden Trophy' : t.name)} <span class="pts">${t.points}</span></button>`).join('')}</div>`;
    wrap.append(card);
  }
  wrap.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {
    openId = Number(b.dataset.jump); switchView('checklist'); renderList(); renderDetail();
  }));
}

// ---- missables ---------------------------------------------------------------
function renderMissables() {
  const t = byId.get(28);
  const safe = [
    ['All 13 story trophies award automatically as you play and cannot be missed.', [6, 7]],
    ['Every quest giver stays available or returns after the story \u2014 the Andy, Billy, Randy, Tyrone and Bret lines can all be finished post-game.', [1, 9]],
    ['Kenton disappears after Chapter 1 but resumes during Chapters 2\u20133 and texts Jason.', [1]],
    ['The Kingpin Bowling gang operation respawns, and its three valuables do not have to be taken in a single visit.', [1]],
    ['Optional missions with hourglass icons are time-sensitive, but they gate no trophy on their own.', [1]],
    ['Nothing on the 100% Completion checklist is missable.', [6, 9]],
    ['The only self-inflicted lockout is cheats: they disable trophies and saving for the session.', [9, 11]]
  ];
  $('missables').innerHTML = `
    <div class="col-detail" style="margin-bottom:11px">${detailHtml(t)}</div>
    <div class="stage-card"><div class="stage-head"><span class="stage-num">CHECKED</span>
      <h3>Everything else: checked and safe</h3></div>
      <p>We checked the whole list against all 11 sources. Beyond the one trophy above, nothing can be permanently missed:</p>
      <ul class="safe-list">${safe.map(([txt, cs]) => `<li>${esc(txt)} ${citesHtml(cs)}</li>`).join('')}</ul>
    </div>`;
  wireDetail($('missables'));
}

// ---- sources view ------------------------------------------------------------
function renderSources() {
  $('sources-view').innerHTML = `
    <table class="src-table"><thead><tr><th>#</th><th>SOURCE</th><th>READ</th><th>CITED BY</th></tr></thead>
    <tbody>${SOURCES.map(s => `<tr>
      <td><span class="cite">[${s.n}]</span></td>
      <td><strong>${esc(s.name)}</strong><div class="u">${esc(s.url)}</div></td>
      <td>${s.read}</td>
      <td>${s.n === 2 ? `${citedBy.get(2)} of 55 guides (rarity)` : `${citedBy.get(s.n)} of 55 guides`}</td>
    </tr>`).join('')}</tbody></table>
    <div class="method-note">
      <p><strong>How this guide was built.</strong> Every step in every guide cites the source that states its fact, and the wording is our own \u2014 trophy names, descriptions and grades are the official ones. Rarity is read live from Exophase [2] on 20 Nov 2026; the launch column is the frozen launch-night read of 19 Nov 2026.</p>
      <p><strong>Where sources disagree, we show both positions</strong> instead of silently picking one: whether the trophy needs the Chapter 1 balcony meditation (Positive Mental Attitude), and how the Shooting Range challenges are laid out (The Shootist). One trophy, Bad Luck, I Guess, has no confirmed method anywhere yet \u2014 its guide says exactly that rather than inventing steps.</p>
    </div>`;
}

// ---- tabs / controls -----------------------------------------------------------
function switchView(v) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
$('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderList(); });
$('sort').addEventListener('change', e => { sortMode = e.target.value; renderList(); });
$('chk-spoilers').addEventListener('change', e => {
  state.spoilers = e.target.checked; save(); renderList(); renderDetail(); renderRoadmap(); renderMissables();
});
$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ earned: [...earned], counts: state.counts, spoilers: state.spoilers }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'platinum-run-progress.json'; a.click();
  URL.revokeObjectURL(a.href);
});
$('btn-import').addEventListener('click', () => $('file-import').click());
$('file-import').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (Array.isArray(data.earned)) earned = new Set(data.earned.filter(id => byId.has(id)));
    if (data.counts) state.counts = data.counts;
    if (typeof data.spoilers === 'boolean') state.spoilers = data.spoilers;
    save(); renderHeader(); renderList(); renderDetail(); renderRoadmap(); renderMissables();
  } catch { /* unreadable file: keep current progress */ }
  e.target.value = '';
});

// ---- go ------------------------------------------------------------------------
renderHeader();
buildChips();
renderList();
renderDetail();
renderRoadmap();
renderMissables();
renderSources();
switchView(['checklist', 'roadmap', 'missables', 'sources'].includes(params.get('view')) ? params.get('view') : 'checklist');
