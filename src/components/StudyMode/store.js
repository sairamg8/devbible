/**
 * Study Mode's reading state: the tier floor, which pages have been opened, and
 * where to pick each technology back up.
 *
 * A module-level store read through `useSyncExternalStore`, exactly like
 * `SidebarCollapseAll/store.js` next door and for the same reason: the pieces
 * that read it sit in different parts of the tree — the controls above the
 * `<ul class="menu__list">`, the tier dots inside it, the paginator in the
 * article — so a context provider would mean swizzling a common ancestor purely
 * to wrap them.
 *
 * ── Hydration ────────────────────────────────────────────────────────────────
 * 🔴 `localStorage` does not exist during the static render, and reading it in
 * a render pass would make the server HTML and the first client paint disagree.
 * So the store starts at defaults on BOTH sides, and {@link hydrate} — called
 * once from an effect — reads storage and notifies. The visible consequence is
 * that the sidebar paints unfiltered for one frame before the floor applies.
 * That is the correct trade: a hydration mismatch blanks the sidebar entirely.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────────
 * Any of this following the reader to another machine. It is per-browser, and
 * the design note said so before it was built. Syncing would need an account
 * system this site does not have and does not want.
 */

import {ALL_TIERS, TIER_CODES} from '@site/src/data/tiers.mjs';

const KEY_FLOOR = 'devbible:study:floor';
const KEY_VISITED = 'devbible:study:visited';
const KEY_RESUME = 'devbible:study:resume';

/**
 * @typedef {object} StudyState
 * @property {string} floor      tier code; every tier at or above it is shown
 * @property {Set<string>} visited  doc ids that have been opened
 * @property {Record<string, {docId: string, title: string, permalink: string, at: number}>} resume
 *           the last page opened, per track
 * @property {boolean} hydrated  false until localStorage has been read
 */

/** @type {StudyState} */
const EMPTY = {
  floor: ALL_TIERS,
  visited: new Set(),
  resume: {},
  hydrated: false,
};

let state = EMPTY;

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// useSyncExternalStore compares snapshots by reference, so this returns the same
// object until something actually changes — never a fresh literal.
export function getSnapshot() {
  return state;
}

// The static render has no storage and no interaction: always the defaults.
export function getServerSnapshot() {
  return EMPTY;
}

function commit(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * localStorage throws rather than returning null in a few real situations —
 * Safari's private mode historically, and any browser configured to block site
 * data. None of them should cost the reader their sidebar, so every access goes
 * through these two.
 */
function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable or full — the session still works, it just forgets */
  }
}

function parseArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function parseObject(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Read localStorage into the store. Safe to call on every mount — it does the
 * work once, so the several components that use the store can each ask without
 * coordinating about who is first.
 */
export function hydrate() {
  if (state.hydrated || typeof window === 'undefined') return;

  const stored = read(KEY_FLOOR);
  commit({
    floor: TIER_CODES.includes(stored) ? stored : ALL_TIERS,
    visited: new Set(parseArray(read(KEY_VISITED))),
    resume: parseObject(read(KEY_RESUME)),
    hydrated: true,
  });
}

export function setTierFloor(floor) {
  if (!TIER_CODES.includes(floor)) return;
  write(KEY_FLOOR, floor);
  commit({...state, floor});
}

/**
 * Record that a page was opened, and make it the track's resume point.
 *
 * Called from the doc page itself rather than from a link handler, so it counts
 * arriving by search, by a cross-link or by typing the URL — all of which are
 * how a reader actually moves through 6,797 pages.
 */
export function markVisited({docId, track, title, permalink}) {
  if (!docId || typeof window === 'undefined') return;

  const visited = state.visited.has(docId) ? state.visited : new Set(state.visited).add(docId);
  const resume = track
    ? {...state.resume, [track]: {docId, title, permalink, at: Date.now()}}
    : state.resume;

  if (visited === state.visited && resume === state.resume) return;

  write(KEY_VISITED, JSON.stringify([...visited]));
  if (resume !== state.resume) write(KEY_RESUME, JSON.stringify(resume));
  commit({...state, visited, resume});
}

/**
 * Forget the reading history — for one track, or for everything.
 *
 * Per-track is the useful one: finishing a track and wanting to reread it should
 * not cost the reader their progress in the other 28.
 */
export function clearProgress(track = null) {
  if (typeof window === 'undefined') return;

  if (!track) {
    write(KEY_VISITED, '[]');
    write(KEY_RESUME, '{}');
    commit({...state, visited: new Set(), resume: {}});
    return;
  }

  const prefix = `${track}/`;
  const visited = new Set([...state.visited].filter((docId) => !docId.startsWith(prefix)));
  const resume = {...state.resume};
  delete resume[track];

  write(KEY_VISITED, JSON.stringify([...visited]));
  write(KEY_RESUME, JSON.stringify(resume));
  commit({...state, visited, resume});
}

/**
 * The track a doc id belongs to: `java/pages/phase-4/02-x` → `java`.
 *
 * Doc ids are paths under `docs/`, and the first segment is the technology
 * folder — which is also how `sidebars.js`, `progress.js` and `stack.js` key
 * everything else, so the four agree without a mapping table.
 */
export function trackOf(docId) {
  return typeof docId === 'string' ? docId.split('/')[0] : null;
}
