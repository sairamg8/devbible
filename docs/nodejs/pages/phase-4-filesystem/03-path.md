---
title: "node:path"
sidebar_label: "03 · node:path"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Never build a path with `+` or template strings. `node:path` normalises
separators, collapses `..`, and behaves correctly on both POSIX and Windows —
and the difference between `join` and `resolve` is a security boundary, not a
style choice.**

## join vs resolve

```js
// joinres.mjs
import path from 'node:path';

console.log('join    ', path.join('/srv', 'app', '..', 'data', 'f.txt'));
console.log('resolve ', path.resolve('data', 'f.txt'));
console.log('join, absolute 2nd arg   ', path.join('/srv/app', '/etc/passwd'));
console.log('resolve, absolute 2nd arg', path.resolve('/srv/app', '/etc/passwd'));
```

```console
$ node joinres.mjs
join     /srv/data/f.txt
resolve  /tmp/…/scratchpad/p4/data/f.txt
join, absolute 2nd arg    /srv/app/etc/passwd
resolve, absolute 2nd arg /etc/passwd
```

| | `join` | `resolve` |
|---|---|---|
| Concatenates and normalises | yes | yes |
| Result is absolute | only if the first segment is | **always** |
| An absolute later argument | treated as a relative segment | **discards everything before it** |
| Uses `process.cwd()` | no | yes, when nothing is absolute |

**That third row is the one to remember.** `resolve` restarting at an absolute
argument is why it is the right tool for validating user input — you can check
the *final* absolute path against your root. `join` silently glues
`/etc/passwd` onto your upload directory, producing something that looks
contained but was never validated. Both behaviours are exploitable if you assume
the other one; see [page 04](04-path-traversal.md).

## The rest of the API

```js
// api.mjs
import path from 'node:path';

console.log('parse    ', path.parse('/srv/app/report.tar.gz'));
console.log('extname  ', path.extname('report.tar.gz'));
console.log('basename ', path.basename('/a/b/report.tar.gz', '.gz'));
console.log('dirname  ', path.dirname('/a/b/c.txt'));
console.log('relative ', path.relative('/srv/app', '/srv/data/f.txt'));
console.log('normalize', path.normalize('/a//b/../c/'));
console.log('isAbsolute', path.isAbsolute('/a'), path.isAbsolute('a'));
```

```console
$ node api.mjs
parse     {
  root: '/',
  dir: '/srv/app',
  base: 'report.tar.gz',
  ext: '.gz',
  name: 'report.tar'
}
extname   .gz
basename  report.tar
dirname   /a/b
relative  ../data/f.txt
normalize /a/c/
isAbsolute true false
```

**`extname` returns only the last extension.** `report.tar.gz` gives `.gz`, and
`parse().name` is `report.tar`. Any "strip the extension" logic on double
extensions has to be written by hand — and file-type checks based on `extname`
are trivially bypassed (`evil.php.jpg`), which is why upload validation uses
content sniffing, not the name.

`path.relative(from, to)` is the one people forget. It is how you turn an
absolute path into something loggable or portable without slicing strings.

Two edge cases worth knowing:

```js
path.basename('/a/b/');   // 'b'   — trailing slash ignored
path.join('');            // '.'   — empty input becomes the current directory
```

## POSIX vs Windows

```js
// platform.mjs
import path from 'node:path';

console.log('sep', JSON.stringify(path.sep), '| delimiter', JSON.stringify(path.delimiter));
console.log('win32 join', path.win32.join('C:\\srv', 'app', 'f.txt'));
console.log('posix join', path.posix.join('/srv', 'app', 'f.txt'));
console.log('win32 handles forward slashes:', path.win32.basename('C:/a/b.txt'));
console.log('posix does NOT handle backslashes:', path.posix.basename('C:\\a\\b.txt'));
```

```console
$ node platform.mjs
sep "/" | delimiter ":"
win32 join C:\srv\app\f.txt
posix join /srv/app/f.txt
win32 handles forward slashes: b.txt
posix does NOT handle backslashes: C:\a\b.txt
```

The default `path` export **is** the platform's implementation: `path.posix` on
Linux and macOS, `path.win32` on Windows. `path.sep` is `/` or `\`, and
`path.delimiter` (`:` vs `;`) is what splits `PATH`.

The asymmetry in the last two lines matters. **Windows accepts both separators;
POSIX treats `\` as an ordinary filename character.** So a Windows-style path
processed on Linux is not split at all — `path.posix.basename('C:\\a\\b.txt')`
returns the whole string. A filename containing a backslash is legal on Linux,
and that is a real source of bugs when a Windows client uploads
`C:\Users\ada\photo.jpg` as the filename and the server stores one file with
backslashes in its name.

**Which to use:**

- **`path`** (the default) for the local filesystem. Always.
- **`path.posix`** for anything that is not a local filesystem path: URL paths,
  S3 keys, tar entries, Docker paths, git paths. These are always
  forward-slashed regardless of the host OS.
- **`path.win32`** only when deliberately manipulating Windows paths on another
  platform.

```js
// a URL path is not a filesystem path
const key = path.posix.join('avatars', userId, 'original.png');   // ✅ s3 key
const key2 = path.join('avatars', userId, 'original.png');        // ❌ backslashes on Windows
```

That second line is the classic bug: a service that works in CI on Linux and
writes `avatars\u1\original.png` as an S3 key when a developer runs it on
Windows.

## Paths and ESM

`__dirname` and `__filename` do not exist in ESM. Node 24 gives you three ways
to replace them, and the modern one is the shortest:

```js
// esmpaths.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('import.meta.dirname ', import.meta.dirname);          // Node 21.2+ — use this
console.log('import.meta.filename', import.meta.filename);
console.log('the older idiom     ', path.dirname(fileURLToPath(import.meta.url)));
```

`import.meta.dirname` and `import.meta.filename` are available and stable on Node
24. They are `undefined` for non-`file:` URLs (a module loaded over HTTP), which
is the only reason to keep the `fileURLToPath` form.

Never do string surgery on `import.meta.url` — [page 05](05-url.md) explains why.

## Gotchas

**Symptom:** Paths contain `\` on Windows in a URL or object-storage key
**Cause:** Used `path.join` for something that is not a filesystem path.
**Fix:** `path.posix.join`.

**Symptom:** A user-supplied path escapes the upload directory
**Cause:** `path.join(root, userInput)` — `..` and absolute inputs are not
rejected.
**Fix:** `path.resolve` plus a prefix check — [page 04](04-path-traversal.md).

**Symptom:** `extname('archive.tar.gz')` gives `.gz`, not `.tar.gz`
**Cause:** Only the final extension is returned.
**Fix:** Handle multi-part extensions explicitly; do not trust extensions for
type checks at all.

**Symptom:** `__dirname is not defined`
**Cause:** ESM module.
**Fix:** `import.meta.dirname`.

**Symptom:** Path comparison fails for paths that are the same
**Cause:** `/a/b` vs `/a/b/` vs `/a//b`, or a mix of separators.
**Fix:** Compare `path.resolve(a) === path.resolve(b)`; on Windows also
case-fold, since the filesystem is case-insensitive.

**Symptom:** Joining an absolute path produced a nonsense result
**Cause:** `join` treats it as relative, `resolve` restarts from it. You used the
other one.
**Fix:** Pick deliberately — `resolve` when the later segment may legitimately be
absolute, `join` when it must not be.

## Interview questions

**★ What is the difference between `path.join` and `path.resolve`?**
`join` concatenates and normalises; the result is absolute only if the first
segment is. `resolve` always produces an absolute path, walking right to left and
**restarting at any absolute argument** — `path.resolve('/srv/app',
'/etc/passwd')` is `/etc/passwd`, while `join` gives `/srv/app/etc/passwd`.

**★ Why does that difference matter for security?**
Because `resolve` gives you the true final path to validate against your root
directory. `join` produces something that *looks* contained even when the input
was absolute, so a prefix check on a `join` result can pass for a path the user
fully controlled.

**★ When do you use `path.posix` explicitly?**
For anything that is not a local filesystem path — URL paths, S3 keys, tar
entries, git paths — because those are always forward-slashed. Using plain
`path.join` there produces backslashes when the code runs on Windows.

**★ What replaces `__dirname` in ESM?**
`import.meta.dirname` (and `import.meta.filename`) on Node 21.2+. The older idiom
is `path.dirname(fileURLToPath(import.meta.url))`, still needed for non-`file:`
URLs.

**Is `path.posix.basename('C:\\a\\b.txt')` `b.txt`?**
No — it returns the whole string, because POSIX treats `\` as an ordinary
filename character. Windows accepts both separators; POSIX does not.

**How do you safely compare two paths?**
Resolve both to absolute form first, and on Windows case-fold as well. Raw string
comparison fails on trailing slashes, doubled separators and separator style.

---

← Prev: [The three flavors](02-the-three-flavors.md) · Next → [Path traversal](04-path-traversal.md)
