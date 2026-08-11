---
title: "Path traversal"
sidebar_label: "10 · Path traversal"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:path` behaviour executed on this machine.

**`path.join` is not a security boundary.** It normalises `..` faithfully, which is
exactly the problem: given user input containing `..`, it happily walks you out of the
directory you meant to stay in. [Phase 4](../phase-4-filesystem/) introduced this as an
API detail; here it is the attack.

## The bug

```js
const ROOT = '/srv/app/uploads';
const file = path.join(ROOT, req.params.name);
res.sendFile(file);
```

```console
path.join('/srv/app/uploads', '../../../etc/passwd') -> /etc/passwd
```

**Outside the root, no error.** `join` did its documented job. Anything that builds a
filesystem path from a request — downloads, uploads, template names, log viewers,
archive extraction — has this shape.

## The fix: resolve, then verify containment

```js
import path from 'node:path';

const ROOT = path.resolve('/srv/app/uploads');

export function safeJoin(root, name) {
  const p = path.resolve(root, name);
  if (p !== root && !p.startsWith(root + path.sep)) {
    throw new Error('outside root');
  }
  return p;
}
```

```console
report.pdf                   -> /srv/app/uploads/report.pdf
../../../etc/passwd          -> rejected: outside root
a/../../../../etc/shadow     -> rejected: outside root
```

`path.resolve` collapses `..` and produces an absolute path; the check then asks a
question with a yes/no answer. Two details make it correct rather than approximately
correct:

**`root + path.sep`, not `root`.** A bare prefix check is bypassable:

```js
path.resolve('/srv/app/uploads-evil/x').startsWith('/srv/app/uploads')   // true
```

Verified `true` — `uploads-evil` shares the prefix. Comparing against `/srv/app/uploads/`
rejects it. The `p !== root` clause allows the root itself.

**Resolve the root once, at module load.** Comparing against a relative or
unnormalised root reintroduces the bug you just fixed.

## What else gets past a naive check

**Absolute paths.** `path.join(ROOT, '/etc/passwd')` stays inside, but
`path.resolve(ROOT, '/etc/passwd')` returns `/etc/passwd` — `resolve` treats an absolute
second argument as a new root. The containment check catches it; nothing else does.

**Null bytes.** Historically truncated the path in C-level APIs. Node rejects them —
`ERR_INVALID_ARG_VALUE` — but reject them yourself so the error is yours and the log
entry is meaningful.

**Encoding.** `%2e%2e%2f` is `../` after URL decoding. Decode **once**, before
validating, and never validate then decode.

**Symlinks.** A file inside the root can point outside it. `path.resolve` is pure string
arithmetic and knows nothing about the filesystem. Where uploads are attacker-controlled,
use `fs.realpath` and re-check containment on the resolved target:

```js
const real = await fs.realpath(p);
if (real !== ROOT && !real.startsWith(ROOT + path.sep)) throw new Error('symlink escape');
```

That is a second syscall per request, so apply it where user-supplied files live, not on
every static asset.

**Windows.** Backslashes, `C:` drive-relative paths, and reserved device names (`CON`,
`NUL`, `AUX`) behave differently. `path.sep` handles the separator; if you ship on
Windows, test there.

## The stronger pattern: never accept a path at all

Containment checks are a fix for a design that hands users a filename. Better designs
remove the question:

```js
// the user names a record; you decide the path
const file = await files.findByIdForUser(req.params.id, req.user.id);   // page 04
if (!file) return res.status(404).end();
res.sendFile(path.join(ROOT, file.storageKey));                          // key you generated
```

Store an opaque generated key (`randomUUID()`) as the on-disk name and keep the original
filename as metadata for the `Content-Disposition` header. The user never supplies
anything that reaches the filesystem, so traversal has no input to work with — and you
also stop worrying about case sensitivity, unicode normalisation and length limits.

**Archive extraction deserves specific mention.** A tar or zip entry named
`../../etc/cron.d/x` is "zip slip", and it is the same bug arriving from a file rather
than a URL. Validate every entry path against the destination root before writing it.

## Gotchas

**Symptom:** A download endpoint returns `/etc/passwd`
**Cause:** `path.join(ROOT, userInput)` with `..` in the input.
**Fix:** `path.resolve` plus a containment check against `ROOT + path.sep`.

**Symptom:** The containment check passes for `/srv/app/uploads-evil/x`
**Cause:** `startsWith(root)` without the separator.
**Fix:** Compare against `root + path.sep`, allowing `p === root`.

**Symptom:** Traversal works through the URL despite validation
**Cause:** `%2e%2e%2f` validated before decoding, or decoded twice.
**Fix:** Decode once, then validate.

**Symptom:** A file inside the root reads a file outside it
**Cause:** Symlink; `path.resolve` does not touch the filesystem.
**Fix:** `fs.realpath` and re-check, for attacker-controlled files.

**Symptom:** Extracting an archive overwrites files outside the target
**Cause:** Zip slip — entry names containing `..`.
**Fix:** Validate each entry path against the destination root before writing.

**Symptom:** An absolute path bypasses the join
**Cause:** `path.resolve(root, '/etc/passwd')` discards the root.
**Fix:** The containment check — it is the only thing that catches this.

**Symptom:** Works on Linux, exploitable on Windows
**Cause:** Backslash separators and drive-relative paths.
**Fix:** Use `path.sep`; test on the platform you deploy to.

## Interview questions

**★ Why isn't `path.join` safe for user input?**
Because normalising `..` is its job, not a defence. `path.join('/srv/app/uploads',
'../../../etc/passwd')` returns `/etc/passwd` with no error — verified. Safety comes from
resolving to an absolute path and then checking it is contained within the root.

**★ What is wrong with `resolved.startsWith(ROOT)`?**
It matches sibling directories that share the prefix — `/srv/app/uploads-evil/x` passes,
verified. Compare against `ROOT + path.sep`, and allow the root itself as a separate
case.

**★ Does the containment check handle absolute paths?**
Yes, and it is the only thing that does. `path.resolve(root, '/etc/passwd')` returns
`/etc/passwd`, because `resolve` treats an absolute argument as a new root. The check
rejects it; a `join`-based approach would not surface it at all.

**★ What does `path.resolve` not protect against?**
Symlinks. It is string arithmetic and never touches the filesystem, so a file inside the
root can point outside it. Where the files are attacker-controlled, `fs.realpath` the
result and re-check containment.

**What is the design that avoids this entirely?**
Do not accept a path. Let the user name a record, look it up scoped to them, and derive
the filename from a key you generated — keeping the original name only as metadata for
the download header. Traversal then has no input to act on.

**What is zip slip?**
Path traversal delivered through an archive: an entry named `../../etc/cron.d/x` escapes
the extraction directory when written naively. Validate every entry's resolved path
against the destination root before writing.

---

← Prev: [XSS and encoding](./09-xss.md) · Next → [CSRF](./11-csrf.md)
