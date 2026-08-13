/**
 * ex08 — Versions and release channels, straight from the registry.
 *
 * Backs: pages/phase-0-how-react-runs/08-versions-and-channels.md
 */
import {section, rows} from './harness.mjs';
import {execFileSync} from 'node:child_process';

// `npm view` wraps its result in an array when the package has more than one
// version matching the spec. Unwrap so callers always see the object.
const npm = (args) => {
  const raw = JSON.parse(execFileSync('npm', [...args, '--json'], {encoding: 'utf8'}));
  return Array.isArray(raw) ? Object.assign({}, ...raw) : raw;
};

section('react dist-tags — what `npm install react@<tag>` gives you');
const tags = npm(['view', 'react', 'dist-tags']);
rows(tags);

section('the same tags for react-dom (they move together)');
rows(npm(['view', 'react-dom', 'dist-tags']));

section('publish dates of the 19.x stable line');
const time = npm(['view', 'react', 'time']);
const stable = Object.entries(time)
  .filter(([v]) => /^19\.\d+\.\d+$/.test(v))
  .sort((a, b) => new Date(a[1]) - new Date(b[1]));
for (const [v, t] of stable) console.log(`  ${v.padEnd(10)} ${t.slice(0, 10)}`);

section('minor releases only — how often does the feature line move?');
const minors = stable.filter(([v]) => v.endsWith('.0'));
for (const [v, t] of minors) console.log(`  ${v.padEnd(10)} ${t.slice(0, 10)}`);
const last = new Date(minors.at(-1)[1]);
rows({
  'latest minor': minors.at(-1)[0],
  'released': minors.at(-1)[1].slice(0, 10),
  'days since': Math.round((Date.now() - last) / 86400000),
});

section('how many canaries were published in the same window?');
// Sort by publish time, not by name — the name ends in a commit hash, so a
// lexical sort returns whichever hash sorts last, not the newest build.
const canaries = Object.entries(time)
  .filter(([v]) => v.includes('canary'))
  .sort((a, b) => new Date(a[1]) - new Date(b[1]));
rows({
  'total canary builds published': canaries.length,
  'newest canary': `${canaries.at(-1)[0]}  (${canaries.at(-1)[1].slice(0, 10)})`,
  'stable minors in the same period': minors.length,
});

section('the ecosystem versions a 2026 project actually installs');
for (const p of ['react-router', 'next', '@vitejs/plugin-react', 'eslint-plugin-react-hooks', 'babel-plugin-react-compiler']) {
  const t = npm(['view', p, 'dist-tags']);
  console.log(`  ${p.padEnd(28)} latest=${t.latest}`);
}
