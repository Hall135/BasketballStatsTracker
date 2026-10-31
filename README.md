# Courtside Basketball Tracker PWA

A browser-based basketball statistics application for recording plays, managing teams and players, viewing box scores, and exporting game results. It runs as an installable Progressive Web App (PWA) after being served from a supported origin.

The application uses:

- **IndexedDB** for browser-local teams, players, games, statistics, and game undo history.
- **Plain HTML, CSS, and JavaScript** with deferred scripts; no server-side database, external libraries, or build step is required.
- A **service worker** that pre-caches the complete application shell for offline use.
- **Local PNG app icons and CSS/text symbols**, with no external icon or font requests.

---

## Features at a Glance

### Player management

- Add individual players with a name and an optional one-to-three-digit jersey number.
- Optionally assign a newly created player to a saved team.
- Edit saved player names and jersey numbers through **Manage player roster → Edit**.
- Cancel an edit to return to the add-player form.
- Delete a saved player after an explicit confirmation.
- Remove deleted players from all saved teams while retaining their information, statistics, and undo history in existing games.
- Preserve player IDs and team memberships during edits. Edited information is used for future games and future roster additions.
- Recreating a deleted player creates a new record and does not reconnect it to earlier games.

### Team and game management

- Create and save multiple named teams.
- Edit team names and player membership; a player may belong to multiple teams.
- Create games with a name and date.
- Select a saved team to check its players, then add or uncheck individual players.
- Create games without selecting a team.
- Add individual players or a saved team's players to an existing game without duplicating player IDs.
- Snapshot team names and player information in each game so later saved-roster changes do not rewrite game history.

### Play tracking

- Tap a player jersey to reveal statistic buttons.
- Record 2PT made/missed, 3PT made/missed, FT made/missed, assists, defensive rebounds, offensive rebounds, steals, blocks, and turnovers.
- Increment each play count by one per tap.
- Calculate total points, field goals, shooting attempts, and total rebounds automatically.
- Undo up to 200 recorded plays or statistic corrections per game.
- Edit raw play counts while keeping calculated totals consistent.

### Box scores and exports

- View player statistics and a team-total row in the box score.
- Use this statistic order in both the box score and CSV:

```text
PTS, REB, AST, STL, BLK, FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, TOV
```

- Show the team summary in this order:

```text
PTS, REB, AST, STL, BLK, TOV
```

- Export one CSV for the selected game, including game, date, team, player, jersey number, player results, and a team-total row.
- Quote CSV values and protect user-supplied names from spreadsheet formula interpretation.

### Offline/PWA behavior

- Includes a web app manifest and service worker.
- Pre-caches the HTML, JavaScript, stylesheet, manifest, and local app icons.
- Uses cache-first fetching with a cached-page fallback for navigation failures.
- Saves changes to IndexedDB in serialized, atomic transactions.
- Prevents an outdated tab from overwriting a more recent save from another tab.
- Uses a responsive phone layout, large player/stat buttons, and horizontally scrollable box scores.

---

## Project Structure

```text
Basketball Tracker App/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── assets/
│   ├── icon-192.png
│   └── icon-512.png
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── playerManager.js
│   ├── stats.js
│   └── storage.js
└── tests/
    └── run-tests.cjs
```

The project folder remains **Basketball Tracker App**. No package installation or build configuration is needed. The deferred JavaScript files share browser globals.

---

## Running the App Locally

Serve the project through HTTP(S). Opening `index.html` through a `file:///` address does not enable service workers or a supported installed-PWA experience.

From the project folder, run:

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open:

```text
http://localhost:8080/
```

On Windows, an alternative is:

```bash
py -m http.server 8080 --bind 127.0.0.1
```

VS Code Live Server can also serve the folder.

### Install as a PWA

For a phone or tablet, publish the project on HTTPS hosting, open it in the browser, and use the browser's install/add-to-home-screen action. On iPhone or iPad Safari, use **Share → Add to Home Screen**. An in-app Install button appears when the browser supplies an installation prompt.

Load the application while connected once so the service worker can finish caching the app shell. Subsequent visits and stat recording can work offline.

### GitHub Pages

Publish the project contents from your chosen GitHub Pages source directory. Keep `index.html`, `manifest.json`, and `service-worker.js` at that directory's root, and include the complete `js/`, `css/`, and `assets/` directories. There is no build step.

Resource paths use `./` so the app supports a repository subpath such as `https://username.github.io/repository/`. GitHub hosting has not been configured or deployed by these local changes.

---

## Local Assets Requirement

All assets used by the app are included in this folder. `index.html` loads:

```text
./css/styles.css
./js/stats.js
./js/storage.js
./js/playerManager.js
./js/app.js
```

App icons live in `assets/`. Jerseys are drawn with CSS `clip-path`, and statistic/action symbols use text characters rendered by system fonts. Their appearance may vary between devices.

The service worker uses `cache.addAll()` with an explicit required-file list. If any listed file is missing, installation of that new worker fails. Preserve the folder structure when publishing.

---

## Data Storage

All application records are stored in the IndexedDB database:

```text
Database: courtside
Version: 1
Object store: app
Record key: state
```

The record contains the roster, saved teams, games, active game selection, and a revision number for conflicting-save protection. Changes are applied to a draft and become current only after the transaction commits. A failed write leaves the prior saved state intact.

IndexedDB is the sole application-data store. There is no localStorage migration or backup mechanism. Existing IndexedDB games and undo snapshots receive zero-valued BLK and TOV counters only when those fields are missing.

No account or cloud synchronization is used. Data remains in that browser and origin: records saved on localhost do not automatically appear on GitHub Pages or another device. Clearing site data removes local records. CSV exports provide copies of results; the app does not import CSVs or offer JSON backup/restore.

---

## Core Basketball Rules

Raw play counters are the source of truth:

```text
PTS = 2 × 2PT made + 3 × 3PT made + FT made
FGM = 2PT made + 3PT made
FGA = 2PT made + 2PT missed + 3PT made + 3PT missed
3PM = 3PT made
3PA = 3PT made + 3PT missed
FTM = FT made
FTA = FT made + FT missed
REB = OREB + DREB
```

AST, STL, BLK, TOV, OREB, and DREB each have independent counters. Points, attempts, and REB have no independent tracking buttons. Team totals sum the selected game's player records. Statistic corrections accept whole-number play counts from 0 through 1,000,000 per counter.

### Player changes and historical results

Editing a saved player updates the reusable roster entry while keeping its ID and saved-team references. It does not rename or renumber the player inside an existing game. Deleting a saved player removes the roster entry and its team references in one save, leaving game player copies, statistics, and game undo snapshots intact.

Player deletion cannot be undone through the app. **Undo last action** applies to recorded game plays and statistic corrections, not player management.

---

## Updating the PWA

When changing pre-cached files, increment the cache version in `service-worker.js`:

```js
const CACHE_NAME = CACHE_PREFIX + 'v4';
```

Publish all changed files together, including the current service worker. Refresh while connected to install the update. The app reloads when a newly installed worker takes control. If an older version remains visible, close and reopen the app or reload again while connected.

Updating the app cache does not clear IndexedDB records. Avoid clearing site storage as a routine update step because that also deletes saved teams and games.

---

## Verification

With Node.js installed, run:

```bash
node tests/run-tests.cjs
```

No package dependencies are needed. The checks cover JavaScript syntax, scoring calculations, BLK/TOV defaults in existing records and undo snapshots, column order, CSV output, serialized saves, failed-write rollback, and player editing/deletion without historical changes.

For browser verification, check player creation/editing, canceling edits/deletion, team membership, existing-game preservation, recording/undo, box scores, exports, reload persistence, phone layout, and loading after the local server is stopped.

---

# File and Function Reference

## Root Files

### `index.html`

Defines the scoring workspace and dialogs for games, players, teams, statistic corrections, and player-deletion confirmation. Loads the stylesheet and four scripts using relative paths. Scripts execute in the order listed above.

### `manifest.json`

Defines application name, description, standalone display mode, relative start URL/scope, theme/background colors, and the 192px/512px PNG icons.

### `service-worker.js`

Defines `CACHE_PREFIX`, versioned `CACHE_NAME`, and `FILES_TO_CACHE`.

- The install handler caches every required file, then requests immediate activation.
- The activate handler removes older caches with this app's prefix and claims clients.
- The fetch handler serves same-origin GET requests from cache when available, otherwise uses the network; failed navigations fall back to cached `index.html`.

### `README.md`

Describes features, setup, project structure, local storage, scoring, updates, tests, and the file/function reference.

## Asset Files

### `assets/icon-192.png` and `assets/icon-512.png`

Local basketball app icons used by the browser, Apple touch icon reference, manifest, and offline cache.

## Styling

### `css/styles.css`

Defines the green/cream visual design, responsive workspace, player jerseys, statistic buttons, team summary, scrollable box score, forms, dialogs, edit/delete controls, and keyboard focus states. It contains no JavaScript or external dependencies.

## JavaScript Files

These are deferred browser scripts. `stats.js`, `storage.js`, and `playerManager.js` expose `CourtStats`, `CourtStorage`, and `CourtPlayers` respectively; `app.js` coordinates them.

### `js/stats.js`

- `fields` — Lists the raw statistic keys, button labels, symbols, and visual groups.
- `blank()` — Returns a fresh set of zero-valued raw counters.
- `totals(stats)` — Calculates points, rebounds, shooting totals, and displayed independent counters.
- `csvCell(value)` — Quotes a CSV cell, escapes quotes, and protects formula-like values.

### `js/playerManager.js`

- `updatePlayer(data, playerId, name, number)` — Validates and updates a reusable player's name and jersey number while preserving its ID, team memberships, and all existing game snapshots.
- `deletePlayer(data, playerId)` — Removes a reusable player and all saved-team references without changing any game records or undo history. Confirmation is handled in the UI before this function runs.

### `js/storage.js`

- `connect()` — Opens the IndexedDB database, creates the object store during upgrade, and handles blocked upgrades/version changes.
- `transaction(action)` — Reads the state record and executes an action in an atomic transaction; resolves only after commit or rejects on abort.
- `load(validate, prepare)` — Loads stored state, applies supported missing-counter defaults, validates records, and initializes an empty state when no record exists.
- `save(data, revision)` — Checks the current revision and persists the next state atomically, rejecting outdated writes from another tab.

### `js/app.js`

State includes saved records, current player/view, form edit targets, storage readiness, revision, and the serialized save queue. `columns` defines box-score/CSV order; `teamColumns` defines summary order.

Functions and helpers:

- `$(selector)` — Finds a UI element.
- `esc(value)` — Escapes text for generated HTML.
- `id()` — Generates a UUID for new players, teams, and games.
- `game()` — Finds the active game.
- `clone(value)` — Creates an independent JSON-compatible copy.
- `notice(message)` — Updates the main status and any supported open-dialog status region.
- `validStats(stats)` — Checks raw counters are valid whole numbers within the supported range.
- `prepareSavedStats(data)` — Adds missing BLK/TOV counters to game players and undo snapshots. Its nested `prepare(stats)` helper updates an individual counter set.
- `validState(data)` — Validates saved players, team references, games, counters, and history.
- `commit(change)` — Queues a draft mutation, saves it, and renders committed results. Failed writes preserve the previous state.
- `dateText(value)` — Formats a stored game date without UTC date shifting.
- `playerLabel(player)` — Formats a jersey number and player name.
- `teamStats(game)` — Sums raw counters across game players.
- `render()` — Draws the game list, active game, team summary, chosen view, and last action.
- `trackMarkup(game)` — Creates player cards and the selected player's stat controls.
- `tableMarkup(game)` — Creates the box score, team total, and abbreviation legend. Its nested `row()` helper formats each table row.
- `teamOptions()` — Builds saved-team selector options.
- `resetPlayerForm(player)` — Switches between adding and editing a saved player; edit mode hides the new-player team-assignment selector.
- `showRoster()` — Opens the player dialog in add mode and displays saved players.
- `renderRoster()` — Lists saved players, team memberships, and edit/delete controls.
- `choices(players, checked)` — Builds selectable player checkboxes.
- `selectTeamPlayers(container, teamId)` — Checks a saved team's players in a roster selector.
- `showGameDialog()` — Opens game creation with today's date and reusable players.
- `renderTeams()` — Lists saved teams and edit controls.
- `resetTeamForm(team)` — Populates a team for editing or resets to create mode.
- `onSaveForm(selector, handler)` — Binds asynchronous form submission and blocks duplicate submits while saving.
- `exportCsv()` — Generates and downloads the selected game's player rows and team total in the defined column order.
- `connectionStatus()` — Updates the online/offline storage label.
- `initialize()` — Loads/validates IndexedDB data before enabling management controls.

Event handlers connect these helpers to player creation/edit/deletion, deletion confirmation, team creation/editing, game creation, adding game players, statistic corrections, player selection, tracking, undo, exports, installation, connection changes, and service-worker updates. Player and game saves use the same atomic commit queue.

## Tests

### `tests/run-tests.cjs`

Dependency-free Node.js regression checks using built-in assertions and VM contexts. It exercises the app's source functions with isolated fixtures and mock save failures; it does not modify browser data.
