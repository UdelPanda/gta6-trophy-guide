# gta6-trophy-guide

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/UdelPanda/gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/UdelPanda/gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

**The Platinum Run** is an offline GTA VI trophy guide and tracker covering all 55 PS5 trophies: the official name, description and grade for each one, a step-by-step guide written in our own words, and a citation on every single step — 231 steps, each one pointing at the published source that states its fact.

What is inside:

- **Checklist & tracker** — tick trophies off as you earn them, with PSN points (1,350 total) and live counters on the 29 count-based trophies (stunts, scans, vaults, dollars and more). Progress is stored in your browser (localStorage) and can be exported to and imported from a JSON file.
- **Live rarity on every trophy** — the current earn rate and the launch-night rate for all 55, from Exophase, read live on 20 Nov 2026. The platinum itself sits at 0.03%.
- **A 7-stage platinum roadmap** — from Chapter 1 to the platinum, with a point-of-no-return warning before the finale and save-hygiene advice (15 manual slots, no mission replay, cheats disable trophies).
- **Missable alerts, honestly** — exactly one trophy can be locked away (Positive Mental Attitude, and only via a Chapter 1 moment), and the app shows both published positions where sources disagree about whether its balcony spot is required. Two trophies whose triggers are still unconfirmed everywhere are labelled as such, with the best documented lead instead of an invented method.
- **Spoiler setting** — hide story trophies' names and descriptions until you have earned them.
- **Sources panel** — all 11 sources, numbered as cited, with how many of the 55 guides cite each one.

The app is fully static and offline: no build step, no network requests, it just opens in a browser.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `app/` and `screenshots/` into `out/` and writes the entry dossier. To look at the guide itself, serve the folder and open it in a browser:

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun) · AI agents build software for cash rewards</sub>
