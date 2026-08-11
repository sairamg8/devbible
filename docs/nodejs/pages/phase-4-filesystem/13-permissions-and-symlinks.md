---
title: "Permissions and symlinks"
sidebar_label: "13 · Permissions, symlinks"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Permissions are POSIX octal bits, `umask` silently removes some of them from
every file you create, and symlinks are the reason a path that passed validation
can still read something else.**

## Modes

```js
// mode.mjs
import { chmod, stat, writeFile } from 'node:fs/promises';

await writeFile('secret.key', 'k');
console.log('default mode:', ((await stat('secret.key')).mode & 0o777).toString(8));
console.log('umask       :', process.umask().toString(8));

await chmod('secret.key', 0o600);
console.log('after chmod :', ((await stat('secret.key')).mode & 0o777).toString(8));
```

```console
$ node mode.mjs
default mode: 644
umask       : 22
after chmod : 600
```

**`stat().mode` includes the file type**, so always mask with `0o777` before
comparing — a plain file's raw mode is `0o100644`, and `mode === 0o644` is
therefore false.

The bits are the familiar three triads, owner/group/other, read(4)/write(2)/
execute(1):

| Octal | Means | Typical use |
|---|---|---|
| `0o600` | owner read+write | private keys, tokens, session files |
| `0o644` | owner rw, everyone read | ordinary files, static assets |
| `0o700` | owner all | private directories |
| `0o755` | owner all, everyone read+execute | directories, executables |

On a directory, **`x` means "may traverse into"**, not "execute". A directory
with `r` but not `x` lists names and cannot open anything inside — a confusing
half-broken state that appears when someone `chmod 644`s a directory.

**Always write octal literals (`0o600`), never decimal.** `chmod(600)` is
`0o1130`, which is nonsense and does not error.

## umask subtracts

```js
writeFile('f', data, { mode: 0o666 });   // request 666
// umask 022 removes group+other write → the file is 644
```

`umask` is a per-process mask of bits to *remove*. With the usual `022`, a
requested `0o666` becomes `0o644` and `0o777` becomes `0o755`. So the `mode`
option is a **maximum**, not a guarantee.

If a file must be `0o600` regardless of the environment's umask, set it
explicitly after creation — or, better, atomically at open time:

```js
const fh = await open('secret.key', 'wx', 0o600);
try { await fh.writeFile(secret); } finally { await fh.close(); }
await chmod('secret.key', 0o600);        // belt and braces if umask interfered
```

`process.umask(0o077)` changes it process-wide, which is a blunt instrument and
racy in a threaded program — prefer explicit `chmod`.

Windows has none of this. `chmod` there only toggles the read-only attribute;
`uid`/`gid` are meaningless. Code that relies on `0o600` for secrecy silently
does nothing on Windows.

## Symlinks

```js
// links.mjs
import { symlink, stat, lstat, realpath, readlink } from 'node:fs/promises';

await symlink('real.txt', 'link.txt');                 // target first, then the link
console.log('stat  : isFile', (await stat('link.txt')).isFile(), 'isSymbolicLink', (await stat('link.txt')).isSymbolicLink());
console.log('lstat : isFile', (await lstat('link.txt')).isFile(), 'isSymbolicLink', (await lstat('link.txt')).isSymbolicLink());
console.log('readlink:', await readlink('link.txt'));   // the raw target string
console.log('realpath:', await realpath('link.txt'));   // fully resolved absolute path
```

```console
$ node links.mjs
stat  : isFile true isSymbolicLink false
lstat : isFile false isSymbolicLink true
readlink: real.txt
realpath: /…/st/real.txt
```

| Call | Answers |
|---|---|
| `symlink(target, path)` | Creates the link. **Argument order is target-first** |
| `readlink(path)` | The literal target string — may be relative, may not exist |
| `realpath(path)` | The fully resolved absolute path, following every link |
| `lstat` | Facts about the link itself |
| `stat` | Facts about what it points to |
| `unlink(path)` | Removes the **link**, never the target |

Two things people get wrong constantly:

- **Argument order.** `symlink(target, path)` mirrors `ln -s target path`. Getting
  it backwards creates a link named after your target, pointing at nothing.
- **Relative targets resolve against the link's directory**, not the process's
  cwd. `symlink('../secret.txt', 'uploads/link.txt')` points at
  `uploads/../secret.txt`. This is exactly the traversal escape from
  [page 04](04-path-traversal.md).

**Hard links** (`link()`) are a second name for the same inode: no target to
break, indistinguishable from the original, and confined to one filesystem.
`stat().nlink` above 1 means other names exist — which is why "delete the file"
may not free the space.

## Where this actually matters

| Situation | What to do |
|---|---|
| Writing a private key, token cache or `.env` | `0o600`, explicit `chmod` after write |
| Creating a directory for user uploads | `0o700`, and never inside a served static root |
| Extracting a user-supplied archive | Reject entries that are symlinks **and** entries whose path escapes ([page 04](04-path-traversal.md)) |
| Serving files from a directory users can write to | `realpath` and re-check containment |
| A deploy that swaps a `current` symlink | The rename-a-symlink trick below |
| Running as non-root in a container | Make sure the data volume is owned by that uid — `EACCES` at boot otherwise |

The deploy pattern is worth knowing because it is the same atomicity idea as
[page 10](10-atomic-writes-and-temp-files.md):

```bash
ln -sfn releases/2026-08-10 current.tmp && mv -T current.tmp current
```

Creating the new link under a temp name and renaming it over `current` swaps the
whole application directory atomically — no window where `current` is missing.

## Gotchas

**Symptom:** `mode === 0o644` is false for a 644 file
**Cause:** `stat().mode` includes the file-type bits (`0o100644`).
**Fix:** `(mode & 0o777) === 0o644`.

**Symptom:** A file created with `{ mode: 0o666 }` is `0o644`
**Cause:** umask removed the write bits.
**Fix:** `chmod` explicitly after creating; treat `mode` as a maximum.

**Symptom:** `chmod(600)` did nothing useful
**Cause:** Decimal 600 is `0o1130`.
**Fix:** Always `0o600`.

**Symptom:** A directory lists but nothing inside can be opened
**Cause:** Read without execute on the directory.
**Fix:** `0o755` (or `0o700`) — `x` is traversal permission.

**Symptom:** `EACCES` only in the container
**Cause:** The image runs as a non-root uid that does not own the mounted
volume.
**Fix:** `chown` the volume or match the uid; do not "fix" it with `0o777`.

**Symptom:** A symlink points at nothing
**Cause:** Reversed `symlink` arguments, or a relative target resolved from the
wrong directory.
**Fix:** `symlink(target, path)`; relative targets resolve from the link's own
directory.

**Symptom:** Deleting files did not free disk space
**Cause:** Hard links, or a process still holding the file open — on POSIX space
is reclaimed only when the last link *and* the last descriptor are gone.
**Fix:** Check `nlink` and `lsof`.

**Symptom:** `chmod 0o600` on Windows leaves the file world-readable
**Cause:** Windows ignores POSIX modes; only the read-only attribute maps.
**Fix:** Use ACLs or platform-appropriate storage; do not assume the mode did
anything.

## Interview questions

**★ What does `umask` do to the `mode` you request?**
It removes bits. With the common `022`, a requested `0o666` becomes `0o644`. The
`mode` option is a ceiling, not a guarantee — set sensitive permissions with an
explicit `chmod` after creation.

**★ Why compare `stat().mode & 0o777`?**
Because `mode` also encodes the file type — a regular file with 644 permissions
reports `0o100644`. Without the mask, equality comparisons always fail.

**★ What is the difference between `readlink` and `realpath`?**
`readlink` returns the literal target string stored in the link, which may be
relative and may not exist. `realpath` resolves the whole chain, following every
link, and returns an absolute path — which is what a containment check needs.

**★ Why do symlinks matter for security?**
A path can pass every string-based containment check and still point outside the
root. `uploads/link.txt` → `../secret.txt` is inside the directory by name and
outside it in reality. Only `realpath` catches it.

**★ On a directory, what does the execute bit mean?**
Permission to traverse into it and access entries by name. Read without execute
lets you list names but open nothing.

**What is the difference between a hard link and a symlink?**
A hard link is another name for the same inode — same filesystem only, no
dangling possible, and the data survives until every link is removed. A symlink
is a path pointer that can cross filesystems and can dangle.

---

← Prev: [Watching files](12-watching.md) · Next → [Virtual filesystems](14-virtual-filesystems.md)
