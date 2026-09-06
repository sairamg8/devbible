/**
 * The four priority tiers, most effort first.
 *
 * 🔴 The ORDER is load-bearing. Study Mode's floor control shows every tier at
 * or above the one chosen, so this array is the ranking itself — reordering it
 * silently changes what the filter hides.
 *
 * The definitions come from instructions.md §3, where the tier answers *"how
 * much effort does this deserve right now?"* — effort allocation, not importance.
 *
 * ── Why `.mjs` ───────────────────────────────────────────────────────────────
 * Two very different consumers import this file:
 *
 *   scripts/tier-map.mjs   Node, at config load, to read badges off disk
 *   src/components/…       the browser bundle
 *
 * `package.json` has no `"type": "module"`, so plain Node treats a `.js` file as
 * CommonJS and would throw on the `export` below. The extension is what lets one
 * copy of this vocabulary serve both sides — and one copy is the point, because
 * a second one drifts the day a tier is renamed.
 *
 * `code` is what travels to the browser: one character per sidebar item, about
 * 6,200 times, instead of the whole word.
 */
export const TIERS = [
  {
    code: 'm',
    slug: 'master',
    label: 'Master',
    blurb: 'Use it confidently without the docs open',
  },
  {
    code: 'u',
    slug: 'understand',
    label: 'Understand',
    blurb: 'Know how it works and use it; mastery not required',
  },
  {
    code: 'k',
    slug: 'know',
    label: 'Know',
    blurb: 'Recognise it and know why it exists; details on demand',
  },
  {
    code: 'w',
    slug: 'when',
    label: 'When needed',
    blurb: 'Do not study upfront — learn it when a project asks',
  },
];

/** Tier codes in ranking order: `['m', 'u', 'k', 'w']`. */
export const TIER_CODES = TIERS.map((tier) => tier.code);

/** The widest floor — every tier visible. The default, and "Study Mode off". */
export const ALL_TIERS = TIER_CODES[TIER_CODES.length - 1];

/**
 * Is a page at `tier` visible when the floor is set to `floor`?
 *
 * 🔴 An untiered page (`null`) is ALWAYS visible. 289 corpus pages carry no
 * badge, and every syllabus and phase index page is deliberately untiered — a
 * filter that swallowed them would make them unreachable rather than deferred,
 * which is the opposite of what a tier floor is for.
 */
export function isAtOrAbove(tier, floor) {
  if (!tier) return true;
  const rank = TIER_CODES.indexOf(tier);
  const limit = TIER_CODES.indexOf(floor);
  return rank >= 0 && limit >= 0 && rank <= limit;
}

/** The tier record for a code, or undefined. */
export function tierByCode(code) {
  return TIERS.find((tier) => tier.code === code);
}
