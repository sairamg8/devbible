---
title: "Directories"
sidebar_label: "07 · Directories"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`readdir` gives you names, not information. `withFileTypes` gives you the type
without a stat per entry, `recursive` walks the tree, and `rm`/`mkdir` with
`recursive: true` are the modern replacements for a pile of deprecated
functions.**

## readdir, three ways

```js
// readdir.mjs
import { readdir } from 'node:fs/promises';

console.log('names        :', await readdir('sandbox'));

const entries = await readdir('sandbox', { withFileTypes: true });
console.log('withFileTypes:', entries.map((e) => `${e.name}:${e.isDirectory() ? 'dir' : 'file'}:parent=${e.parentPath}`));

console.log('recursive    :', await readdir('sandbox', { recursive: true }));
```

```console
$ node readdir.mjs
names        : [ 'a.txt', 'nested' ]
withFileTypes: [ 'a.txt:file:parent=sandbox', 'nested:dir:parent=sandbox' ]
recursive    : [ 'a.txt', 'nested', 'nested/deep' ]
```

**`withFileTypes: true` is nearly always what you want.** Without it you have
names only, so telling files from directories costs one `stat` syscall per
entry — on a directory with 10 000 files that is 10 000 extra syscalls, each
occupying a thread pool slot.

```js
// ❌ one stat per entry
for (const name of await readdir(dir)) {
  const s = await stat(path.join(dir, name));
  if (s.isFile()) …
}

// ✅ the type came with the listing
for (const entry of await readdir(dir, { withFileTypes: true })) {
  if (entry.isFile()) …
}
```

A `Dirent` has `name`, `parentPath`, and the predicates `isFile()`,
`isDirectory()`, `isSymbolicLink()`, `isFIFO()`, `isSocket()`,
`isBlockDevice()`, `isCharacterDevice()`.

**`parentPath` replaced `path`**, which is deprecated on `Dirent`. Note that
`entry.parentPath` is the *directory*, so the full path is
`path.join(entry.parentPath, entry.name)` — a very common off-by-one in code
copied from older answers.

**`recursive: true` returns paths relative to the directory you asked about**
(`nested/deep`, not `sandbox/nested/deep`). Combine both options and the
`Dirent`s carry the correct `parentPath` for each level.

## Order is not guaranteed

`readdir` returns entries in whatever order the filesystem provides — creation
order on some, hash order on others, alphabetical on none reliably. **Sort
explicitly** if order matters:

```js
const files = (await readdir(dir, { withFileTypes: true }))
  .filter((e) => e.isFile())
  .map((e) => e.name)
  .sort();      // do not rely on the filesystem
```

This is why "migrations ran in the wrong order" bugs happen: they were numbered
but never sorted, and it worked on the developer's ext4 and failed on the
container's overlayfs.

## Walking a large tree without buffering it

`readdir` with `recursive: true` builds the whole array in memory first. For a
huge tree, `opendir` gives you an async iterator:

```js
// walk.mjs
import { opendir } from 'node:fs/promises';
import path from 'node:path';

async function* walk(dir) {
  for await (const entry of await opendir(dir)) {       // one entry at a time
    const full = path.join(entry.parentPath, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

let count = 0;
for await (const file of walk('sandbox')) count++;
console.log('files found:', count);
```

`opendir` holds a directory handle open while you iterate — that is the trade:
constant memory instead of a full array, at the cost of a descriptor per open
level. The `for await` closes it for you, including on `break`.

## Creating and deleting

```js
import { mkdir, rm, cp } from 'node:fs/promises';

await mkdir('a/b/c', { recursive: true });          // mkdir -p; no EEXIST
await rm('a', { recursive: true, force: true });    // rm -rf; no ENOENT
await cp('src', 'dest', { recursive: true });       // cp -r
```

| Modern | Replaces | Note |
|---|---|---|
| `rm(p, { recursive: true })` | `rmdir(p, { recursive: true })` | The `rmdir` recursive option is <strong>⚠ Deprecated</strong> (DEP0147) |
| `rm(p, { force: true })` | `unlink` + ENOENT handling | `force` makes a missing path a no-op |
| `mkdir(p, { recursive: true })` | `mkdirp`, `fs-extra.ensureDir` | Built in since Node 10 |
| `cp(src, dst, { recursive: true })` | `fs-extra.copy` | Stable since Node 22 |

`rm` without `recursive` refuses directories (`ERR_FS_EISDIR`); `rmdir` refuses
non-empty ones (`ENOTEMPTY`). `rm(path, { recursive: true, force: true })` is the
idempotent cleanup you want in a `finally` block.

`cp` also takes `filter`, `dereference` (follow symlinks) and
`errorOnExist`/`force`, which is what makes it a real replacement for
`fs-extra`.

## Checking a directory is empty

There is no `isEmpty`. The cheap way avoids listing everything:

```js
import { opendir } from 'node:fs/promises';

async function isEmpty(dir) {
  const handle = await opendir(dir);
  try {
    return (await handle.read()) === null;     // read one entry
  } finally {
    await handle.close();
  }
}
```

`(await readdir(dir)).length === 0` reads the entire directory to answer a
yes/no question — fine for a config folder, wasteful for a spool directory with
a million files.

## Gotchas

**Symptom:** `ENOENT` when opening a file that `readdir` just listed
**Cause:** `readdir` returns bare names; you used the name as a path from the
wrong working directory.
**Fix:** `path.join(dir, name)`, or `path.join(entry.parentPath, entry.name)`.

**Symptom:** `entry.path` is `undefined` or logs a deprecation
**Cause:** `Dirent.path` was renamed `parentPath`.
**Fix:** Use `parentPath`.

**Symptom:** Migration or fixture files run in the wrong order
**Cause:** Relied on `readdir` ordering, which is filesystem-dependent.
**Fix:** Sort explicitly.

**Symptom:** A directory listing endpoint times out on a big directory
**Cause:** `readdir` with `recursive: true` builds the entire array first.
**Fix:** `opendir` and stream, and paginate the response.

**Symptom:** Thread pool saturation while scanning a tree
**Cause:** One `stat` per entry.
**Fix:** `withFileTypes: true`.

**Symptom:** `rm` throws `ERR_FS_EISDIR`
**Cause:** No `recursive: true`.
**Fix:** Add it — with `force: true` for idempotent cleanup.

**Symptom:** A recursive walk never finishes
**Cause:** A symlink loop — `a/link -> ..`.
**Fix:** Skip symlinks with `entry.isSymbolicLink()`, or track visited
`realpath`s. `readdir({ recursive: true })` does not follow symlinked
directories, but a hand-written walk with `stat` does.

**Symptom:** Hidden files are missing from a listing
**Cause:** Not `readdir` — it returns dotfiles. Something downstream filtered
them.
**Fix:** Check your own filter; `.` and `..` are never included.

## Interview questions

**★ Why use `withFileTypes: true`?**
The listing already knows each entry's type, so you avoid one `stat` syscall per
entry. On a large directory that is thousands of extra async operations
competing for the four-thread libuv pool.

**★ Can you rely on `readdir` ordering?**
No. It is whatever the filesystem returns, and it differs between ext4, APFS,
overlayfs and NTFS. Sort explicitly — ordered migrations are the usual casualty.

**★ How do you walk a very large tree without exhausting memory?**
`opendir`, which yields entries one at a time as an async iterator, instead of
`readdir({ recursive: true })`, which materialises the whole array. The cost is
holding a directory handle open per level.

**★ What replaced `fs.rmdir(path, { recursive: true })`?**
`fs.rm(path, { recursive: true, force: true })`. The `rmdir` recursive option is
deprecated (DEP0147). `force` also makes a missing path a no-op, which is what
you want in cleanup code.

**How do you cheaply test whether a directory is empty?**
`opendir` and read a single entry — `null` means empty. `readdir(...).length`
reads every entry to answer a boolean.

**What is `entry.parentPath`?**
The directory containing the entry; the full path is
`path.join(entry.parentPath, entry.name)`. It replaced the deprecated
`entry.path`.

---

← Prev: [File streams](06-file-streams.md) · Next → [stat and existence](08-stat-and-existence.md)
