import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {globSync} from 'node:fs';
import path from 'node:path';

const root = '/mnt/Storage/Backup/Knowledge/devbible/docs/expressjs/pages';
const files = globSync('phase-*/[0-9]*.md', {cwd: root});
let n = 0;
const manifest = [];
for (const f of files.sort()) {
  const src = readFileSync(path.join(root, f), 'utf8');
  // pair each ```js block with the ```console block that follows it, if any
  const re = /```js\n([\s\S]*?)```\n+(?:```console\n([\s\S]*?)```)?/g;
  let m, i = 0;
  while ((m = re.exec(src))) {
    const [, code, out] = m;
    if (!/console\.log|app\.listen|createServer/.test(code)) continue;
    i++;
    const id = `${f.replace(/[\/.]/g, '_')}__${i}`;
    mkdirSync('extracted', {recursive: true});
    writeFileSync(`extracted/${id}.mjs`, code);
    manifest.push({id, file: f, expected: (out || '').trim()});
    n++;
  }
}
writeFileSync('extracted/manifest.json', JSON.stringify(manifest, null, 2));
console.log('extracted', n, 'runnable blocks from', files.length, 'pages');
