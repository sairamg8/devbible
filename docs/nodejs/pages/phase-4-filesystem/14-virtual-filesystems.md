---
title: "Virtual filesystems"
sidebar_label: "14 · Virtual filesystems"
sidebar_position: 14
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**A virtual filesystem is an object that implements the `fs` interface without
touching a disk. You need one for two reasons: testing filesystem code without
temp directories, and bundling assets into a single executable.**

Skip this page until you hit one of those.

## Injecting a filesystem

Node's stream constructors accept an `fs` option — the hook that makes
substitution possible without monkey-patching:

```js
// inject.mjs
import { createReadStream } from 'node:fs';
import { text } from 'node:stream/consumers';

const DATA = Buffer.from('from a fake filesystem');

const fakeFs = {
  open(path, flags, mode, cb) { cb(null, 42); },              // pretend fd
  read(fd, buffer, offset, length, position, cb) {
    const from = position ?? 0;                                // null/undefined = current cursor
    if (from >= DATA.length) return cb(null, 0, buffer);       // EOF
    const end = Math.min(from + length, DATA.length);
    const bytesRead = DATA.copy(buffer, offset, from, end);
    cb(null, bytesRead, buffer);
  },
  close(fd, cb) { cb(null); },
};

console.log(await text(createReadStream('/nowhere', { fs: fakeFs, start: 0 })));
```

```console
$ node inject.mjs
from a fake filesystem
```

Note `position ?? 0` and `start: 0`. Without `start`, Node passes `position:
undefined` to mean "read from the current offset", and the arithmetic silently
produces `NaN` — the stream then ends with **zero bytes and no error**. Getting
this wrong is a good illustration of why writing your own `fs` implementation is
a bad use of an afternoon.

That is the mechanism every in-memory filesystem uses. In application code you
rarely implement it by hand — you take the dependency.

## The options

| Tool | Use |
|---|---|
| **`memfs`** | A full in-memory `fs` implementation with the same API. The standard choice for tests |
| **`node:test` `mock.module()`** | Mock `node:fs` module-wide. **Stability 1.0 – Early development** on Node 24 |
| **A real temp directory** (`mkdtemp`) | Slower but exercises the real filesystem, including permissions and `EXDEV` |
| **Single Executable Applications** | Assets embedded in the binary, read through `sea` APIs |
| **`fs` option on stream constructors** | Targeted substitution, no globals touched |

## Testing: memfs versus a temp directory

```js
// with memfs
import { fs as memfs, vol } from 'memfs';
vol.fromJSON({ '/app/config.json': '{"port":3000}' });
const config = JSON.parse(memfs.readFileSync('/app/config.json', 'utf8'));
```

```js
// with a real temp directory
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(tmpdir(), 'test-'));
try {
  await writeFile(path.join(dir, 'config.json'), '{"port":3000}');
  await runTheThing(dir);
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

**The trade-off is fidelity versus speed and isolation.**

An in-memory filesystem is fast, needs no cleanup, and cannot leave litter or
collide between parallel tests. But it does *not* reproduce the behaviours this
phase spent pages on: `EXDEV` across mounts, umask, permission errors, symlink
resolution, case-insensitivity, `EMFILE`. A test suite that only runs against
`memfs` will happily pass code that fails on a real container volume.

**The practical split:** unit-test logic against an in-memory filesystem;
integration-test the actual write/rename/permission paths against a real temp
directory. Do not mock the filesystem in the tests whose entire subject *is* the
filesystem.

The strongest version of this is not mocking at all — **inject the filesystem as
a dependency**:

```js
// storage.mjs
export function makeStorage({ fs = defaultFs, root }) {
  return {
    async read(key) { return fs.readFile(path.join(root, key), 'utf8'); },
    async write(key, data) { return writeFileAtomic(fs, path.join(root, key), data); },
  };
}
```

Then tests pass `memfs` and production passes `node:fs/promises`, with no global
patching and no module-mocking machinery. It also leaves the door open for an S3
or database-backed implementation of the same interface later.

## Single Executable Applications

The other reason a virtual filesystem appears: shipping one binary with your
assets inside it.

```js
// sea-assets.mjs
import { getAsset, getAssetAsBlob, isSea } from 'node:sea';

const template = isSea()
  ? new TextDecoder().decode(getAsset('index.html'))     // from inside the binary
  : await readFile(new URL('./index.html', import.meta.url), 'utf8');
```

Assets are declared in the SEA config and read with `node:sea` — they are *not*
on the filesystem, so `readFile` cannot find them. Code that must work both ways
branches on `isSea()`, which is the pattern above.

`node:sea` is **Stability 1.1 – Active development** on Node 24, and
`node:sea` is one of the four **prefix-only** builtins (`require('sea')` falls
through to npm — see [Phase 1](../phase-1-modules/03-node-prefix.md)).

## Gotchas

**Symptom:** Tests pass against a mocked fs, production fails with `EXDEV`
**Cause:** In-memory filesystems have one "device", so cross-mount renames
always succeed.
**Fix:** Integration-test the write path against a real temp directory.

**Symptom:** Permission tests pass everywhere and mean nothing
**Cause:** Most in-memory filesystems do not enforce modes.
**Fix:** Test permissions on a real filesystem, and skip on Windows.

**Symptom:** `mock.module()` behaves differently after a Node upgrade
**Cause:** It is Stability 1.0 – Early development.
**Fix:** Prefer dependency injection; keep module mocking for cases with no seam.

**Symptom:** `readFile` cannot find an asset in a single executable
**Cause:** Assets live inside the binary, not on disk.
**Fix:** `sea.getAsset()`, branching on `isSea()`.

**Symptom:** Mocked `fs` leaks between tests
**Cause:** A shared in-memory volume was not reset.
**Fix:** `vol.reset()` in `beforeEach`, or a fresh instance per test.

## Interview questions

**★ When would you use an in-memory filesystem?**
For fast, isolated unit tests of code that reads and writes files, where the
subject is the *logic* rather than the filesystem behaviour — and for bundling
assets into a single executable.

**★ What does mocking the filesystem hide?**
Everything platform-specific: `EXDEV` across mounts, umask, permission errors,
symlink resolution, case-insensitivity, descriptor limits. Those are precisely
the failures that only appear in production, so the write path deserves a real
temp-directory test.

**★ How do you substitute a filesystem without monkey-patching globals?**
Either the `fs` option that stream constructors accept, or — better — inject the
filesystem module as a dependency, so tests pass `memfs` and production passes
`node:fs/promises`.

**How do you read a bundled asset in a single executable?**
`sea.getAsset()` from `node:sea`, branching on `isSea()` so the same code still
works when run normally. The assets are not on the filesystem, so `readFile`
fails.

---

← Prev: [Permissions and symlinks](13-permissions-and-symlinks.md) · Phase index → [Filesystem, paths and URLs](README.md)
