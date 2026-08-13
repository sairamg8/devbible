import {readFileSync, writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile);
const manifest = JSON.parse(readFileSync('extracted/manifest.json', 'utf8'));
const results = [];
for (const m of manifest) {
  let actual = '', status = 'ok';
  try {
    const {stdout, stderr} = await run('node', [`extracted/${m.id}.mjs`], {timeout: 15000});
    actual = (stdout + stderr).trim();
  } catch (e) {
    status = 'ERROR';
    actual = ((e.stdout || '') + (e.stderr || e.message || '')).trim();
  }
  results.push({...m, actual, status});
}
writeFileSync('extracted/results.json', JSON.stringify(results, null, 2));
const errs = results.filter((r) => r.status === 'ERROR');
console.log(`ran ${results.length} blocks · ${errs.length} threw`);
for (const e of errs) console.log(`  ERROR ${e.file}: ${e.actual.split('\n').find(l=>/Error|error/.test(l)) || e.actual.split('\n')[0]}`);
