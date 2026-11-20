// THE PLATINUM RUN — GTA VI trophy guide & tracker.
// Loads the official trophy list and our cited guides from data/trophies.json, keeps the player's
// progress (earned ticks + per-trophy counters + spoiler setting) in localStorage, and renders
// four views: Checklist, Roadmap, Missables, Sources. It fetches nothing beyond its own data file.

const STORAGE_KEY = 'platinum-run-progress-v1';
const RARITY_SOURCE_N = 3; // Exophase supplies every trophy's live earn rate.
const KIND_FILTERS = [
  ['all', 'All'], ['story', 'Story'], ['missable', 'Missable'], ['collectibles', 'Collectibles'],
  ['activities', 'Activities'], ['side', 'Side'], ['crime', 'Crime'], ['world', 'World'],
  ['money', 'Money'], ['completion', 'Completion'],
];
const GRADE_FILTERS = [['all', 'All grades'], ['platinum', 'Platinum'], ['gold', 'Gold'], ['silver', 'Silver'], ['bronze', 'Bronze']];

let trophyData = null;
let progress = loadSavedProgress();
const uiState = { view: 'checklist', kind: 'all', grade: 'all', sort: 'official', search: '', selectedId: 28 };

function loadSavedProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      return {
        earned: new Set(Array.isArray(raw.earned) ? raw.earned : []),
        counters: raw.counters && typeof raw.counters === 'object' ? raw.counters : {},
        spoilers: raw.spoilers === true,
      };
    }
  } catch { /* a corrupt save falls through to a fresh one */ }
  return { earned: new Set(), counters: {}, spoilers: false };
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    earned: [...progress.earned], counters: progress.counters, spoilers: progress.spoilers,
  }));
  flashSavedNote();
}

function flashSavedNote() {
  const note = document.getElementById('saved-note');
  note.textContent = 'Saved in this browser ✓ just now';
  setTimeout(() => { note.textContent = 'Saved in this browser'; }, 1600);
}

// A shared link can carry a demo state: ?earned=2,3,8&open=28&view=roadmap&spoilers=on&count=28:7,35:64
function applySharedLinkState() {
  const params = new URLSearchParams(location.search);
  if (params.has('earned')) {
    progress.earned = new Set(params.get('earned').split(',').map(Number).filter((n) => n >= 1 && n <= 55));
  }
  if (params.has('count')) {
    for (const pair of params.get('count').split(',')) {
      const [id, value] = pair.split(':').map(Number);
      if (id >= 1 && id <= 55 && Number.isFinite(value)) progress.counters[id] = value;
    }
  }
  if (params.get('spoilers') === 'on') progress.spoilers = true;
  if (params.get('spoilers') === 'off') progress.spoilers = false;
  if (params.has('open')) uiState.selectedId = Number(params.get('open')) || uiState.selectedId;
  if (['checklist', 'roadmap', 'missables', 'sources'].includes(params.get('view'))) uiState.view = params.get('view');
  if (params.has('earned') || params.has('count') || params.has('spoilers')) saveProgress();
}

async function loadTrophyData() {
  const response = await fetch('data/trophies.json');
  trophyData = await response.json();
}

function trophyById(id) { return trophyData.trophies.find((t) => t.id === id); }
function isEarned(t) { return progress.earned.has(t.id); }
function isStoryTrophy(t) { return t.kinds.includes('story'); }
function isHiddenBySpoilers(t) { return progress.spoilers && isStoryTrophy(t) && !isEarned(t); }
function formatPct(p) { return `${p}%`; }
function citationText(cites) { return cites.map((n) => `[${n}]`).join(''); }
function trophyCitedSources(t) {
  const set = new Set();
  for (const step of t.steps) for (const n of step.cite) set.add(n);
  if (typeof t.rarityLivePct === 'number') set.add(RARITY_SOURCE_N);
  return [...set].sort((a, b) => a - b);
}
function sourceCitedByCount(n) {
  return trophyData.trophies.filter((t) => trophyCitedSources(t).includes(n)).length;
}

function computeAuditCounts() {
  const trophies = trophyData.trophies;
  const grades = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  let steps = 0, citedSteps = 0, guidesCiting = 0;
  for (const t of trophies) {
    grades[t.grade] += 1;
    let cites = false;
    for (const s of t.steps) { steps += 1; if (s.cite.length > 0) { citedSteps += 1; cites = true; } }
    if (cites) guidesCiting += 1;
  }
  return {
    total: trophies.length, grades,
    secret: trophies.filter((t) => t.secret).length,
    missable: trophies.filter((t) => t.missable).length,
    steps, citedSteps, guidesCiting,
    sources: trophyData.sources.length,
    counters: trophies.filter((t) => t.count).length,
    readDate: trophyData.sources[0].read,
  };
}

/* ---------------- header + audit ---------------- */

function renderHeader() {
  const earned = trophyData.trophies.filter(isEarned);
  const points = earned.reduce((sum, t) => sum + t.points, 0);
  document.getElementById('earned-count').textContent = `${earned.length} / ${trophyData.trophies.length}`;
  document.getElementById('points-count').textContent = `${points.toLocaleString('en-US')} pts`;
  document.getElementById('platinum-rarity').textContent = formatPct(trophyById(1).rarityLivePct);
  document.getElementById('spoiler-toggle').checked = progress.spoilers;
}

function renderAuditStrip() {
  const a = computeAuditCounts();
  const strip = document.getElementById('audit-strip');
  strip.innerHTML =
    `<span><b>${a.total}</b> official trophies</span>` +
    `<span><b>${a.grades.platinum}P ${a.grades.gold}G ${a.grades.silver}S ${a.grades.bronze}B</b></span>` +
    `<span><b>${a.secret}</b> hidden on PSN</span>` +
    `<span><b>${a.guidesCiting}/${a.total}</b> guides cite a source</span>` +
    `<span><b>${a.citedSteps}/${a.steps}</b> steps cited</span>` +
    `<span><b>${a.counters}</b> trophies with live counters</span>` +
    `<span class="audit-warn"><b>${a.missable}</b> possibly missable</span>` +
    `<span><b>${a.sources}</b> sources read ${a.readDate}</span>` +
    `<span>live rarity on all ${a.total} from Exophase [3], read ${a.readDate}</span>`;
}

/* ---------------- checklist ---------------- */

function trophyMatchesFilters(t) {
  if (uiState.kind === 'missable' && !t.missable) return false;
  if (uiState.kind !== 'all' && uiState.kind !== 'missable' && !t.kinds.includes(uiState.kind)) return false;
  if (uiState.grade !== 'all' && t.grade !== uiState.grade) return false;
  if (uiState.search) {
    const haystack = isHiddenBySpoilers(t) ? 'hidden story trophy' : `${t.name} ${t.description}`.toLowerCase();
    if (!haystack.includes(uiState.search.toLowerCase())) return false;
  }
  return true;
}

function sortTrophiesForList(list) {
  const sorted = [...list];
  if (uiState.sort === 'rarest') sorted.sort((a, b) => a.rarityLivePct - b.rarityLivePct || a.id - b.id);
  else if (uiState.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort((a, b) => a.id - b.id);
  return sorted;
}

function renderFilterChips() {
  const kindHost = document.getElementById('kind-chips');
  kindHost.replaceChildren();
  for (const [key, label] of KIND_FILTERS) {
    const count = key === 'all' ? trophyData.trophies.length
      : key === 'missable' ? trophyData.trophies.filter((t) => t.missable).length
      : trophyData.trophies.filter((t) => t.kinds.includes(key)).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip${uiState.kind === key ? ' on' : ''}`;
    chip.innerHTML = `${label} <b>${count}</b>`;
    chip.addEventListener('click', () => { uiState.kind = key; renderChecklist(); });
    kindHost.append(chip);
  }
  const gradeHost = document.getElementById('grade-chips');
  gradeHost.replaceChildren();
  for (const [key, label] of GRADE_FILTERS) {
    const count = key === 'all' ? trophyData.trophies.length : trophyData.trophies.filter((t) => t.grade === key).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip${uiState.grade === key ? ' on' : ''}`;
    chip.innerHTML = `${label} <b>${count}</b>`;
    chip.addEventListener('click', () => { uiState.grade = key; renderChecklist(); });
    gradeHost.append(chip);
  }
}

function makeBadge(grade) {
  const badge = document.createElement('span');
  badge.className = `badge ${grade}`;
  badge.textContent = grade;
  return badge;
}

function renderTrophyRow(t) {
  const hidden = isHiddenBySpoilers(t);
  const row = document.createElement('div');
  row.className = `trophy-row${isEarned(t) ? ' earned' : ''}${uiState.selectedId === t.id ? ' selected' : ''}`;
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned(t);
  box.setAttribute('aria-label', `Mark ${hidden ? 'hidden story trophy' : t.name} earned`);
  box.addEventListener('click', (event) => event.stopPropagation());
  box.addEventListener('change', () => toggleEarned(t.id, box.checked));
  const body = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'row-name';
  name.textContent = hidden ? 'Hidden story trophy' : t.name;
  const desc = document.createElement('div');
  desc.className = hidden ? 'row-hidden-note' : 'row-desc';
  desc.textContent = hidden ? 'Name and description hidden until earned — spoiler shield is on.' : t.description;
  const meta = document.createElement('div');
  meta.className = 'row-meta';
  meta.append(makeBadge(t.grade));
  for (const kind of t.kinds) {
    const tag = document.createElement('span');
    tag.className = 'kind-tag';
    tag.textContent = kind;
    meta.append(tag);
  }
  if (t.missable) {
    const flag = document.createElement('span');
    flag.className = 'missable-flag';
    flag.textContent = '⚠ MISSABLE?';
    meta.append(flag);
  }
  if (t.count) {
    const tag = document.createElement('span');
    tag.className = 'kind-tag';
    const value = progress.counters[t.id] ?? 0;
    tag.textContent = `counter ${value}/${t.count.target}`;
    meta.append(tag);
  }
  body.append(name, desc, meta);
  const rarity = document.createElement('div');
  rarity.className = 'rarity';
  rarity.textContent = formatPct(t.rarityLivePct);
  const rarityLabel = document.createElement('small');
  rarityLabel.textContent = 'of players [3]';
  rarity.append(rarityLabel);
  row.append(box, body, rarity);
  row.addEventListener('click', () => { if (!hidden) selectTrophy(t.id); });
  return row;
}

function renderTrophyList() {
  const list = document.getElementById('trophy-list');
  const visible = sortTrophiesForList(trophyData.trophies.filter(trophyMatchesFilters));
  list.replaceChildren(...visible.map(renderTrophyRow));
  document.getElementById('list-count').textContent =
    `Showing ${visible.length} of ${trophyData.trophies.length} trophies · rarity = live earn rate, Exophase [3], read 20 Nov 2026`;
}

function renderChecklist() {
  renderFilterChips();
  renderTrophyList();
  renderDetailPanel();
  renderSourcesPanel();
}

/* ---------------- detail panel ---------------- */

function appendCiteSpans(parent, cites) {
  const span = document.createElement('span');
  span.className = 'cite';
  span.textContent = ` ${citationText(cites)}`;
  parent.append(span);
}

function renderGuideSteps(t, list) {
  for (const step of t.steps) {
    const li = document.createElement('li');
    li.append(document.createTextNode(step.text));
    appendCiteSpans(li, step.cite);
    list.append(li);
  }
}

function setCounterValue(id, value) {
  const t = trophyById(id);
  const clamped = Math.max(0, Math.min(t.count.target, Math.floor(value) || 0));
  progress.counters[id] = clamped;
  saveProgress();
  renderChecklist();
  renderHeader();
}

function renderCounterWidget(t) {
  const wrap = document.createElement('div');
  wrap.className = 'counter-widget';
  const value = progress.counters[t.id] ?? 0;
  const label = document.createElement('span');
  label.className = 'counter-label';
  label.textContent = `Your count — ${t.count.label}:`;
  const minus = document.createElement('button');
  minus.type = 'button'; minus.textContent = '−';
  minus.addEventListener('click', () => setCounterValue(t.id, value - t.count.step));
  const input = document.createElement('input');
  input.type = 'number'; input.min = '0'; input.max = String(t.count.target); input.value = String(value);
  input.setAttribute('aria-label', t.count.label);
  input.addEventListener('change', () => setCounterValue(t.id, Number(input.value)));
  const plus = document.createElement('button');
  plus.type = 'button'; plus.textContent = '+';
  plus.addEventListener('click', () => setCounterValue(t.id, value + t.count.step));
  const of = document.createElement('span');
  of.className = 'counter-label';
  of.textContent = `/ ${t.count.target.toLocaleString('en-US')}`;
  const bar = document.createElement('div');
  bar.className = 'counter-bar';
  const fill = document.createElement('div');
  fill.className = 'counter-fill';
  fill.style.width = `${Math.min(100, (value / t.count.target) * 100)}%`;
  bar.append(fill);
  wrap.append(label, minus, input, plus, of, bar);
  if (value >= t.count.target) {
    const done = document.createElement('span');
    done.className = 'counter-done';
    done.textContent = 'Target reached — tick it earned.';
    wrap.append(done);
  }
  return wrap;
}

function renderDetailPanel() {
  const panel = document.getElementById('detail-panel');
  const t = trophyById(uiState.selectedId) ?? trophyData.trophies[0];
  panel.replaceChildren();
  if (isHiddenBySpoilers(t)) {
    const h = document.createElement('h2');
    h.textContent = 'Hidden story trophy';
    const p = document.createElement('p');
    p.className = 'summary-text';
    p.textContent = 'The spoiler shield is on: this story trophy stays hidden until you earn it in the game and tick it here.';
    panel.append(h, p);
    return;
  }
  const head = document.createElement('div');
  head.className = 'detail-head';
  const title = document.createElement('h2');
  title.textContent = t.name;
  const earnedLabel = document.createElement('label');
  earnedLabel.className = 'detail-earned';
  const earnedBox = document.createElement('input');
  earnedBox.type = 'checkbox';
  earnedBox.checked = isEarned(t);
  earnedBox.addEventListener('change', () => toggleEarned(t.id, earnedBox.checked));
  earnedLabel.append(earnedBox, document.createTextNode('Earned'));
  head.append(title, earnedLabel);

  const quote = document.createElement('blockquote');
  quote.className = 'official-quote';
  quote.append(document.createTextNode(`“${t.description}”`));
  const quoteNote = document.createElement('small');
  quoteNote.textContent = 'Official PlayStation description, quoted verbatim [2]';
  quote.append(quoteNote);

  const facts = document.createElement('div');
  facts.className = 'fact-row';
  const stage = trophyData.stages.find((s) => s.n === t.stage);
  facts.innerHTML =
    `<span>Grade <b>${t.grade}</b></span><span><b>${t.points}</b> PSN points</span>` +
    `<span>Roadmap stage <b>${t.stage} · ${stage.title}</b></span>` +
    `<span>${t.secret ? 'Hidden on PSN until earned' : 'Visible on PSN'}</span>` +
    `<span class="rarity-line">Live rarity <b>${formatPct(t.rarityLivePct)}</b> of tracked players [3] · launch night ${formatPct(t.rarityLaunchPct)} [3]</span>`;

  const summaryHead = document.createElement('h3');
  summaryHead.textContent = 'In short';
  const summary = document.createElement('p');
  summary.className = 'summary-text';
  summary.textContent = t.summary;

  panel.append(head, quote, facts, summaryHead, summary);

  if (t.missable && t.missableNote) {
    const warn = document.createElement('div');
    warn.className = 'warn-box';
    const warnTitle = document.createElement('span');
    warnTitle.className = 'warn-title';
    warnTitle.textContent = '⚠ POSSIBLY MISSABLE — READ BEFORE YOU PLAY PAST IT';
    warn.append(warnTitle, document.createTextNode(t.missableNote));
    panel.append(warn);
  }
  if (t.disagree) {
    const box = document.createElement('div');
    box.className = 'disagree-box';
    const boxTitle = document.createElement('span');
    boxTitle.className = 'warn-title';
    boxTitle.textContent = 'SOURCES DISAGREE — BOTH VERSIONS SHOWN';
    box.append(boxTitle, document.createTextNode(t.disagree));
    panel.append(box);
  }
  const stepsHead = document.createElement('h3');
  stepsHead.textContent = 'How to earn it — step by step';
  const steps = document.createElement('ol');
  steps.className = 'steps';
  renderGuideSteps(t, steps);
  panel.append(stepsHead, steps);

  if (t.count) panel.append(renderCounterWidget(t));

  const sourceLine = document.createElement('p');
  sourceLine.className = 'source-line';
  const names = trophyCitedSources(t).map((n) => {
    const s = trophyData.sources.find((x) => x.n === n);
    return `[${n}] ${s.name.split(' — ')[0]}`;
  });
  sourceLine.innerHTML = `<b>Sources for this guide:</b> ${names.join(' · ')} — every step above cites by number; full matrix in the Sources tab.`;
  panel.append(sourceLine);
}

/* ---------------- sources side panel ---------------- */

function renderSourcesPanel() {
  const host = document.getElementById('sources-panel');
  host.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = 'Sources — cited by number';
  host.append(h);
  for (const s of trophyData.sources) {
    const item = document.createElement('div');
    item.className = 'source-item';
    const name = document.createElement('div');
    name.className = 'src-name';
    name.innerHTML = `<span class="src-n">[${s.n}]</span>${s.name.split(' — ')[1] ?? s.name}`;
    const url = document.createElement('div');
    url.className = 'src-url';
    url.textContent = s.url;
    const meta = document.createElement('div');
    meta.className = 'src-meta';
    meta.textContent = `read ${s.read} · cited by ${sourceCitedByCount(s.n)} of 55 guides`;
    item.append(name, url, meta);
    host.append(item);
  }
  const note = document.createElement('p');
  note.className = 'src-meta';
  note.style.fontSize = '10.8px';
  note.textContent = 'Live rarity on every trophy is source [3], read 20 Nov 2026. No step in this app states a fact without its source number.';
  host.append(note);
}

/* ---------------- roadmap view ---------------- */

function renderStageNote(note) {
  const p = document.createElement('p');
  p.className = 'stage-note';
  const marker = 'POINT OF NO RETURN:';
  const at = note.indexOf(marker);
  if (at === -1) { p.textContent = note; return p; }
  const rest = note.slice(at + marker.length);
  const end = rest.indexOf('. ');
  p.append(document.createTextNode(note.slice(0, at)));
  const span = document.createElement('span');
  span.className = 'ponr';
  span.textContent = marker + (end === -1 ? rest : rest.slice(0, end + 1));
  p.append(span, document.createTextNode(end === -1 ? '' : rest.slice(end + 1)));
  return p;
}

function renderRoadmapView() {
  const host = document.getElementById('view-roadmap');
  host.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'view-intro';
  intro.innerHTML = '<b>The road to the platinum:</b> one playthrough, no difficulty settings, no mission replay — about <b>200 hours</b> at a 4/10 difficulty [1][5]. ' +
    'Play the story first while scanning and studying as you go, then work the 100% checklist in free-roam. Stages below follow the order the official descriptions unlock in; click any trophy to open its guide.';
  host.append(intro);
  const grid = document.createElement('div');
  grid.className = 'stage-grid';
  for (const stage of trophyData.stages) {
    const card = document.createElement('div');
    card.className = 'stage-card';
    const h = document.createElement('h3');
    h.innerHTML = `<span class="stage-n">Stage ${stage.n}</span> · ${stage.title}`;
    card.append(h, renderStageNote(stage.note));
    const chips = document.createElement('div');
    chips.className = 'stage-trophies';
    for (const t of trophyData.trophies.filter((x) => x.stage === stage.n)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `stage-chip${isEarned(t) ? ' done' : ''}`;
      chip.textContent = isHiddenBySpoilers(t) ? 'Hidden story trophy' : `${t.name}${t.missable ? ' ⚠' : ''}`;
      chip.addEventListener('click', () => { if (!isHiddenBySpoilers(t)) { selectTrophy(t.id); setActiveView('checklist'); } });
      chips.append(chip);
    }
    card.append(chips);
    grid.append(card);
  }
  host.append(grid);
}

/* ---------------- missables view ---------------- */

function renderMissablesView() {
  const host = document.getElementById('view-missables');
  host.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'view-intro';
  const hiddenCount = trophyData.trophies.filter(isHiddenBySpoilers).length;
  intro.innerHTML = '<b>Missables, checked one by one:</b> of the 55 trophies, exactly <b>one</b> is flagged as possibly missable by the guides we cite [1][4][5]. ' +
    'Everything else is either automatic story progress or stays available in free-roam after the credits — the evidence is listed beside the warning.' +
    (progress.spoilers ? ` Spoiler shield is <b>ON</b>: ${hiddenCount} unearned story trophies are currently hidden across the app.` : ' Spoiler shield is off.');
  host.append(intro);
  const grid = document.createElement('div');
  grid.className = 'miss-grid';

  const missable = trophyData.trophies.find((t) => t.missable);
  const card = document.createElement('div');
  card.className = 'miss-card';
  const mh = document.createElement('h3');
  mh.textContent = `⚠ Possibly missable — ${missable.name}`;
  const mDesc = document.createElement('p');
  mDesc.textContent = `Official: “${missable.description}” ${missable.grade} · ${missable.points} pts · live rarity ${formatPct(missable.rarityLivePct)} of players [3]`;
  const mNote = document.createElement('p');
  mNote.textContent = missable.missableNote;
  const mDis = document.createElement('p');
  mDis.textContent = missable.disagree;
  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'chip';
  openBtn.textContent = 'Open its full guide in the checklist';
  openBtn.addEventListener('click', () => { selectTrophy(missable.id); setActiveView('checklist'); });
  card.append(mh, mDesc, mNote, mDis, openBtn);

  const safe = document.createElement('div');
  safe.className = 'safe-card';
  const sh = document.createElement('h3');
  sh.textContent = 'Checked and safe — cannot be missed';
  safe.append(sh);
  const list = document.createElement('ul');
  list.className = 'safe-list';
  const storyNames = trophyData.trophies.filter(isStoryTrophy)
    .map((t) => (isHiddenBySpoilers(t) ? 'Hidden story trophy' : t.name)).join(', ');
  const safeItems = [
    `<b>All 12 story trophies</b> (${storyNames}) — awarded automatically as their chapters and missions complete [1].`,
    '<b>Every character strand</b> — Andy, Kenton, Billy, Randy, Tyrone and Bret all stay available after the story; Kenton pauses mid-story and returns with a text in Chapter 2–3 [1].',
    '<b>Let’s Go Bowling</b> — the Kingpin Bowling operation respawns, and any key valuable you missed can be taken on a later visit [1].',
    '<b>The 100% checklist</b> — nothing it requires is missable; everything remains in free-roam after the credits [1].',
    '<b>Expiring optional missions</b> (hourglass icons) and a few magazine collectibles in story buildings disappear, but none of them gate a trophy [1].',
  ];
  for (const html of safeItems) {
    const li = document.createElement('li');
    li.innerHTML = html;
    list.append(li);
  }
  safe.append(list);
  const saveNote = document.createElement('p');
  saveNote.innerHTML = '<b>Save discipline:</b> the game has 15 manual save slots and no mission replay — keep a save at the start and end of every chapter (10 saves) and rotate the rest [1][4]. Cheats disable trophies and saving, so keep them off a trophy run [1].';
  safe.append(saveNote);
  grid.append(card, safe);
  host.append(grid);
}

/* ---------------- sources view ---------------- */

function renderSourcesView() {
  const host = document.getElementById('view-sources');
  host.replaceChildren();
  const intro = document.createElement('p');
  intro.className = 'view-intro';
  const a = computeAuditCounts();
  intro.innerHTML = `<b>Where every fact in this app comes from.</b> Each guide step ends with the numbers of the sources it rests on: ` +
    `<b>${a.citedSteps}/${a.steps} steps cited</b>, <b>${a.guidesCiting}/${a.total} guides citing</b>. A step with no source states nothing specific. ` +
    `Where sources disagree, both versions are shown in the guide itself — see Positive Mental Attitude. All sources were read on 20 Nov 2026, the day after launch.`;
  host.append(intro);
  const table = document.createElement('table');
  table.className = 'source-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>Source</th><th>What it covers</th><th>Read</th><th>Cited by</th></tr>';
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const s of trophyData.sources) {
    const tr = document.createElement('tr');
    const tdN = document.createElement('td');
    tdN.innerHTML = `<b>[${s.n}]</b>`;
    const tdName = document.createElement('td');
    const nameB = document.createElement('b');
    nameB.textContent = s.name;
    const url = document.createElement('div');
    url.className = 'src-url';
    url.textContent = s.url;
    tdName.append(nameB, url);
    const tdCovers = document.createElement('td');
    tdCovers.textContent = s.covers;
    const tdRead = document.createElement('td');
    tdRead.textContent = s.read;
    const tdBy = document.createElement('td');
    tdBy.innerHTML = `<b>${sourceCitedByCount(s.n)}</b> of 55 guides`;
    tr.append(tdN, tdName, tdCovers, tdRead, tdBy);
    tbody.append(tr);
  }
  table.append(tbody);
  host.append(table);
  const note = document.createElement('p');
  note.className = 'view-intro';
  note.style.marginTop = '10px';
  note.textContent = 'Citations are shown as plain text on purpose: this app works fully offline and never fetches a source — the addresses above are for the reader to visit in their own browser. Trophy names, descriptions and grades are quoted from the official PlayStation list [2]; everything else is written for this app, in our own words.';
  host.append(note);
}

/* ---------------- actions ---------------- */

function toggleEarned(id, on) {
  if (on) progress.earned.add(id); else progress.earned.delete(id);
  saveProgress();
  renderHeader();
  renderChecklist();
  if (uiState.view === 'roadmap') renderRoadmapView();
  if (uiState.view === 'missables') renderMissablesView();
}

function selectTrophy(id) {
  uiState.selectedId = id;
  renderChecklist();
}

function setActiveView(view) {
  uiState.view = view;
  for (const tab of document.querySelectorAll('#view-tabs .tab')) {
    tab.classList.toggle('active', tab.dataset.view === view);
  }
  for (const section of document.querySelectorAll('main .view')) {
    section.hidden = section.id !== `view-${view}`;
  }
  if (view === 'roadmap') renderRoadmapView();
  if (view === 'missables') renderMissablesView();
  if (view === 'sources') renderSourcesView();
  if (view === 'checklist') renderChecklist();
}

function exportProgressToFile() {
  const payload = JSON.stringify({
    app: 'the-platinum-run', version: 1,
    earned: [...progress.earned], counters: progress.counters, spoilers: progress.spoilers,
  }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'platinum-run-progress.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function importProgressFromFile(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const raw = JSON.parse(String(reader.result));
      if (!raw || !Array.isArray(raw.earned)) throw new Error('not a progress file');
      progress = {
        earned: new Set(raw.earned.map(Number).filter((n) => n >= 1 && n <= 55)),
        counters: raw.counters && typeof raw.counters === 'object' ? raw.counters : {},
        spoilers: raw.spoilers === true,
      };
      saveProgress();
      renderHeader();
      renderChecklist();
    } catch {
      alert('That file is not a Platinum Run progress export.');
    }
  });
  reader.readAsText(file);
}

function wireUpControls() {
  document.getElementById('export-btn').addEventListener('click', exportProgressToFile);
  document.getElementById('import-input').addEventListener('change', (event) => {
    if (event.target.files[0]) importProgressFromFile(event.target.files[0]);
    event.target.value = '';
  });
  document.getElementById('spoiler-toggle').addEventListener('change', (event) => {
    progress.spoilers = event.target.checked;
    saveProgress();
    renderChecklist();
  });
  document.getElementById('sort-select').addEventListener('change', (event) => {
    uiState.sort = event.target.value;
    renderTrophyList();
  });
  document.getElementById('search-input').addEventListener('input', (event) => {
    uiState.search = event.target.value;
    renderTrophyList();
  });
  for (const tab of document.querySelectorAll('#view-tabs .tab')) {
    tab.addEventListener('click', () => setActiveView(tab.dataset.view));
  }
}

await loadTrophyData();
applySharedLinkState();
wireUpControls();
renderHeader();
renderAuditStrip();
setActiveView(uiState.view);
