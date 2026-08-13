/**
 * Baseline status, read from the `web-features` package — the data set behind
 * the Baseline badges on MDN and web.dev.
 *
 * This is the ONLY source the pages use for "is it safe to ship". A render in
 * the local Firefox proves that Firefox supports something; it says nothing
 * about Chrome or Safari, and this machine has neither.
 *
 * Note: `require('web-features/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED,
 * so the version is read off disk.
 */
import {features} from 'web-features';
import {readFileSync} from 'node:fs';

export const WEB_FEATURES_VERSION = JSON.parse(
  readFileSync(new URL('./node_modules/web-features/package.json', import.meta.url)),
).version;

export const FEATURE_COUNT = Object.keys(features).length;

/** `high` = Widely available, `low` = Newly available, `false` = Limited. */
export function baseline(key) {
  const f = features[key];
  if (!f) return {key, found: false};
  return {
    key,
    found: true,
    name: f.name,
    baseline: f.status.baseline,
    label:
      f.status.baseline === 'high'
        ? 'Widely available'
        : f.status.baseline === 'low'
          ? 'Newly available'
          : 'Limited availability',
    since: f.status.baseline_low_date ?? null,
    widelySince: f.status.baseline_high_date ?? null,
  };
}

/** A printable table for a list of feature keys. */
export function table(keys) {
  return keys.map(baseline).map((b) =>
    b.found
      ? `${b.key.padEnd(28)} ${b.label.padEnd(20)} ${(b.since ?? '—').padEnd(12)} ${b.name}`
      : `${b.key.padEnd(28)} NOT A FEATURE KEY`,
  );
}
