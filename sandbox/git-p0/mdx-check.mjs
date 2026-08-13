// Compiles every docs/git/**/*.md with the site's own MDX compiler, so the Git
// corpus can be verified even when `yarn build` aborts on another corpus's file.
// Run from the project root:  node sandbox/git-p0/mdx-check.mjs
import {compile} from '@mdx-js/mdx';
import {readFileSync, globSync} from 'node:fs';

const files = globSync('docs/git/**/*.md').sort();
let bad = 0;
for (const f of files) {
  try {
    await compile(readFileSync(f, 'utf8'));
  } catch (e) {
    bad++;
    console.log(`FAIL ${f}\n  ${e.message.split('\n')[0]}`);
  }
}
console.log(`checked ${files.length} git files, ${bad} failed`);
process.exit(bad === 0 ? 0 : 1);
