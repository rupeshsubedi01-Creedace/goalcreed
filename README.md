# ⚽ GoalCreed

**Live football, built for the touch.** A dark-mode-first mobile app with precise
match timing, real-time scoreboards, detailed statistics and goal-scoring
timelines — powered by free football APIs and wrapped in snappy micro-interactions
with haptic feedback on every touch element.

Built to be developed **entirely from an Android phone** in a cloud editor, with
clean, incremental commits pushed to GitHub at every milestone.

---

## Features

| Area | What you get |
| --- | --- |
| 🟢 Live tab | All matches in play, minute counter that keeps ticking *locally* between polls, pull-to-refresh, per-day request budget guard |
| 📅 Fixtures tab | ±7-day date strip, fixtures grouped by competition, live leagues float to top |
| 🏟 Match detail | Scoreboard hero (a.e.t. / pens aware), sliding segmented control → **Timeline · Stats · Lineups** |
| 🥅 Goal timeline | Events split by half (goals, penalties, own goals, cards, subs, VAR), assist credits, add-time minutes (`45+2'`) |
| 📊 Stats | Animated mirrored bars — possession, xG, shots, passes, duels… normalized from raw API values (`"55%"`, `"267 / 338"`) |
| 🛡 Crests | High-quality transparent club badges from **TheSportsDB**, instant API-Football logo fallback, initials monogram offline |
| 📳 Haptics | Press-DOWN tick on every touch (spring squish + click), selection detents on pickers/segmented control, and the **goal-alert pattern** (success thud → double knock → heavy roll) when a score moves |
| ⚙️ Settings | BYO free API keys, poll cadence (30–300 s), haptics switch, connection test, cache wiper |

## Data sources

1. **[API-Football](https://www.api-football.com/) v3** (`v3.football.api-sports.io`) →
   live scores, fixtures, events (timeline), statistics, lineups.
   Endpoints used:
   - `GET /fixtures?live=all`
   - `GET /fixtures?date=YYYY-MM-DD`
   - `GET /fixtures?events|statistics|lineups?fixture=ID`
   - `GET /status` (key health check)

   Free individual plan ≈ **100 requests/day** — the app caches aggressively
   (memory + AsyncStorage, stale-while-offline) and shows a live budget meter.

2. **[TheSportsDB](https://www.thesportsdb.com/api/v1/json/3/)** → club badges
   (`searchteams.php`), league emblems (`leagues.php?s=SEASON`), fan-art mood
   images. The public key `3` works out of the box; register for your own if needed.

### Getting an API-Football key (2 minutes, free)

1. Create an account at `dashboard.api-football.com` → register.
2. Copy the **Individual token** from your profile.
3. In GoalCreed: **Settings → Live scores · stats · timeline → paste key → Test connection**.

*Or* set `EXPO_PUBLIC_API_FOOTBALL_KEY` in your cloud editor's env so it's baked into the build.

## Run it from your phone (no computer)

```
Workflow:  GitHub repo  ⇄  cloud IDE (CodeSandbox / StackBlitz / Codespaces)  →  Expo Go
```

1. **Fork/clone this repo on GitHub.**
2. Open it in your cloud editor of choice:
   - **CodeSandbox** → *Import from GitHub* → runs `npm install` for you, or
   - **StackBlitz** → WebContainers run `npm install && npx expo start` fully in-browser, or
   - **GitHub Codespaces** → VS Code in the browser.
3. Install **Expo Go** (Play Store) on your phone.
4. In the editor terminal run `npm run android` (or open the Expo QR/link from `expo start`).
   Expo Go renders the app on-device — **haptics included** (Expo Go ships `expo-haptics`).
5. Paste your API key in the app's Settings tab. Done — you're live.

### Checks you can run in the editor terminal

| Command | Verifies |
| --- | --- |
| `npm run typecheck` | strict TypeScript across the whole app |
| `npm test` | 20 unit tests for the pure core (clock/status, timeline classifier, stats normalizer, sorting/grouping) |
| `npx expo export --platform android` | full Metro/Hermes bundle of every screen |

## Incremental GitHub workflow (phone-friendly)

Every milestone is its own commit with a conventional message; push after each one:

```bash
git add -A
git commit -m "feat(live): goal flash + ticking clock"   # clean, descriptive
git push origin main                                      # from the editor terminal
```

This repo's history follows exactly that cadence:

```
chore: scaffold Expo SDK 57 TypeScript app …
feat(ui): dark-mode-first theme, haptic engine and PressableScale touch primitive
feat(api): API-Football live/stats/timeline client + TheSportsDB logo client
feat(screens): Live / Fixtures / Settings tabs with request-budget meter
feat(match): scoreboard hero, goal timeline, stat bars, lineups
test(core): unit tests for clock, timeline, stats normalization
docs: phone-only cloud dev playbook
```

If the editor's terminal is awkward, `git push` still works via **GitHub Mobile /
the repo's web UI** for review — commits stay the source of truth.

## Project layout

```
src/
├─ app/                 # expo-router routes
│  ├─ _layout.tsx       # providers: QueryClient → Settings → Stack, splash gate
│  ├─ (tabs)/           # index.tsx (Live) · fixtures.tsx · settings.tsx
│  └─ match/[id].tsx    # detail: hero + Timeline/Stats/Lineups
├─ api/
│  ├─ client.ts         # cached fetch funnel, budget counter, error translation
│  ├─ apifootball.ts    # API-Football endpoints
│  ├─ sportsdb.ts       # throttled TheSportsDB lookups (badges/emblems)
│  ├─ normalize.ts      # RN-free core: UiMatch, timeline, stat rows  ← unit-tested
│  └─ types.ts
├─ components/          # PressableScale, MatchCard, StatBar, TimelineFeed, TeamLogo…
├─ lib/                 # haptics engine, ticking clock, goal watcher, settings store
└─ theme/               # dark-first tokens (colors, spacing, motion springs)
```

## Tech

Expo SDK 57 · React Native 0.86 · TypeScript (strict) · expo-router ·
@tanstack/react-query (polling) · react-native-reanimated 4 (micro-interactions) ·
expo-haptics · expo-image (crests) · AsyncStorage (cache + settings).

## Notes & ethics

- Respect the free tiers: default polling is **60 s**; raise only when you need it.
- TheSportsDB's key `3` is a public demo — consider registering your own for heavy use.
- No tracking, no accounts: data flows API → phone cache.
