---
title: "Path traversal"
sidebar_label: "04 · Path traversal"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Any filesystem path built from user input is a security boundary. `../` in a
filename, an absolute path, a URL-encoded separator or a symlink each turns a
file-serving endpoint into "read any file on the host".**

## The vulnerable code

```js
// ❌ every one of these is exploitable
app.get('/files/:name', (req, res) => res.sendFile(path.join(UPLOADS, req.params.name)));
await readFile(`${UPLOADS}/${req.query.file}`);
await readFile(path.join(UPLOADS, req.body.path));
```

```js
// traversal.mjs
import path from 'node:path';
const ROOT = path.resolve('uploads');

const unsafeJoin = (p) => path.join(ROOT, p);

function safeResolve(p) {
  const full = path.resolve(ROOT, p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error('path traversal');
  return full;
}

for (const p of ['ok.txt', '../secret.txt', '..%2fsecret.txt', 'sub/../ok.txt', '/etc/passwd', 'uploads-evil/x']) {
  const unsafe = unsafeJoin(p);
  let guarded;
  try { guarded = safeResolve(p); } catch { guarded = 'REJECTED'; }
  console.log(JSON.stringify(p).padEnd(20), '| join:', unsafe.padEnd(24), '| guarded:', guarded);
}
```

```console
$ node traversal.mjs
"ok.txt"             | join: ./uploads/ok.txt          | guarded: ./uploads/ok.txt
"../secret.txt"      | join: ./secret.txt              | guarded: REJECTED
"..%2fsecret.txt"    | join: ./uploads/..%2fsecret.txt | guarded: ./uploads/..%2fsecret.txt
"sub/../ok.txt"      | join: ./uploads/ok.txt          | guarded: ./uploads/ok.txt
"/etc/passwd"        | join: ./uploads/etc/passwd      | guarded: REJECTED
"uploads-evil/x"     | join: ./uploads/uploads-evil/x  | guarded: ./uploads/uploads-evil/x
```

Line by line, this is the whole attack surface:

- **`../secret.txt`** — `join` normalises it straight out of the root. This is
  the entire classic vulnerability.
- **`/etc/passwd`** — `join` treats the absolute path as relative and produces
  `uploads/etc/passwd`, which looks contained. `resolve` produces `/etc/passwd`,
  which the prefix check rejects. **Both behaviours are dangerous if you assume
  the other one.**
- **`..%2fsecret.txt`** — still encoded, so it is a harmless literal filename
  *here*. It becomes `../` the moment something decodes it. Decode **before**
  validating, exactly once, and never after.
- **`sub/../ok.txt`** — legitimately resolves back inside. A naive
  `if (input.includes('..')) reject` would refuse valid input while missing
  encoded and absolute attacks. Blacklisting `..` is the wrong shape of fix.

## The check that works

```js
// safe.mjs
import path from 'node:path';
import { realpath } from 'node:fs/promises';

const ROOT = path.resolve(process.env.UPLOAD_DIR ?? './uploads');

export async function resolveUserPath(userInput) {
  if (typeof userInput !== 'string' || userInput.includes('\0')) {
    throw Object.assign(new Error('invalid path'), { statusCode: 400 });
  }

  // 1. resolve against the root — absolute inputs and ../ are collapsed here
  const candidate = path.resolve(ROOT, userInput);

  // 2. containment check, WITH the separator
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) {
    throw Object.assign(new Error('path traversal'), { statusCode: 403 });
  }

  // 3. follow symlinks and check again — the file may point outside
  const real = await realpath(candidate);
  if (real !== ROOT && !real.startsWith(ROOT + path.sep)) {
    throw Object.assign(new Error('symlink escape'), { statusCode: 403 });
  }

  return real;
}
```

Each step defends against something different:

1. **`path.resolve(ROOT, input)`** normalises `..` and neutralises an absolute
   input by making it the final path — which step 2 then rejects.
2. **`ROOT + path.sep`, not `ROOT`.** Without the separator,
   `/srv/uploads-evil/x` passes a `startsWith('/srv/uploads')` check. Verified:

   ```console
   $ node -e "…resolve(ROOT,'../uploads-evil/x').startsWith(ROOT)"
   true
   ```

   A sibling directory whose name merely begins with your root's name is a real
   escape, and this one-character bug is common in production code.
3. **`realpath`.** The path can be inside the root and still point outside:

   ```console
   $ node symlink.mjs
   symlink escapes the check: ./uploads/link.txt -> realpath ./secret.txt
   ```

   `uploads/link.txt` passes every string check. It is a symlink to
   `../secret.txt`. Only resolving the real path catches it — which matters
   whenever users can create files in that tree (extracted archives, git
   checkouts, mounted volumes).

**The null byte check** in step 0 is for older interop: `"ok.txt\0.png"` used to
truncate at the null in C-level APIs. Node throws
`ERR_INVALID_ARG_VALUE` on null bytes in paths today, so this is belt and braces
— but validating input type explicitly also rejects arrays and objects, which
Express query parsing can hand you (`?file=a&file=b` gives an array).

## The stronger pattern: do not use the name at all

The check above is correct, but the best defence is not accepting paths:

```js
// ✅ the user names a record, not a file
const file = await db.file.findUnique({ where: { id: req.params.id, ownerId: req.user.id } });
if (!file) return res.status(404).end();
const abs = path.join(STORAGE_ROOT, file.storageKey);   // storageKey is a UUID we generated
```

Store uploads under generated names (a UUID), keep the original filename as
*metadata*, and let the user address files by ID. Traversal becomes impossible
because no user string ever reaches the filesystem — and you get ownership
checks, which the path-validation version does not give you for free.

**Trade-off:** you need a database row per file and a mapping step. Worth it for
anything multi-tenant. For a static docs directory with no user data, the
validated path is fine.

## Related bugs in the same family

| Bug | Shape | Fix |
|---|---|---|
| **Zip-slip** | An archive entry named `../../etc/cron.d/x` | Validate every entry path with the same check before extracting |
| **Upload filename** | `Content-Disposition: filename="../../app.js"` | Never use the client's filename as a path |
| **Log injection via path** | Path fragments written to logs unescaped | Log the resolved path, or a file ID |
| **Case-insensitive bypass** | `/UPLOADS/` on macOS/Windows matches `/uploads/` | Case-fold both sides on those platforms |
| **Unicode normalisation** | Composed vs decomposed forms of the same name | `String.prototype.normalize('NFC')` before comparing |

## Gotchas

**Symptom:** `GET /files/..%2f..%2fetc%2fpasswd` returns the passwd file
**Cause:** The framework decoded the URL after your check, or you checked the
raw string.
**Fix:** Decode once, then validate the decoded value.

**Symptom:** A prefix check passes for `/srv/uploads-evil/…`
**Cause:** `startsWith(ROOT)` without `path.sep`.
**Fix:** `startsWith(ROOT + path.sep)`, plus the exact-equal case for the root
itself.

**Symptom:** Validation passes but the file read is outside the root
**Cause:** A symlink inside the tree.
**Fix:** `realpath` and re-check.

**Symptom:** Legitimate filenames like `report..final.pdf` are rejected
**Cause:** Blacklisting the substring `..`.
**Fix:** Resolve and compare instead of pattern-matching.

**Symptom:** `TypeError` — the path is an array
**Cause:** Duplicated query parameters (`?file=a&file=b`) parse to an array.
**Fix:** Assert `typeof input === 'string'` first.

**Symptom:** Extracting a user archive overwrote application files
**Cause:** Zip-slip — entry names are attacker-controlled paths.
**Fix:** Run the same containment check on every entry before writing it.

**Symptom:** Works on Linux, exploitable on Windows
**Cause:** `..\` is a separator on Windows; a Linux-only check missed it. Also
case-insensitivity.
**Fix:** Use `path.resolve`/`path.sep` (platform-aware) rather than hand-written
`/` logic.

## Interview questions

**★ Why is `path.join(UPLOADS, userInput)` unsafe?**
`join` normalises `..`, so `../../etc/passwd` walks out of the directory. And an
absolute input is treated as relative, producing a path that *looks* contained
without ever having been validated. Neither behaviour rejects anything.

**★ What is the correct check?**
Resolve the input against the root with `path.resolve`, then require the result
to equal the root or start with `root + path.sep`, then `realpath` it and repeat
the check to defeat symlinks.

**★ Why `root + path.sep` rather than `root`?**
Because `/srv/uploads-evil/x` starts with `/srv/uploads`. Without the separator a
sibling directory sharing the prefix passes the check — verified `true` on Node
24.

**★ Why is `realpath` necessary if the string check passed?**
The path can be inside the root and still be a symlink pointing outside.
Demonstrated: `uploads/link.txt` resolves to `../secret.txt`. String checks
cannot see through symlinks.

**★ What is zip-slip?**
An archive whose entry names contain `../`, so extracting it writes outside the
target directory. The fix is the same containment check applied to every entry
before writing.

**What is better than validating user paths?**
Not accepting them. Store files under generated identifiers, keep the original
name as metadata, and have users address files by ID — which also gets you
ownership checks.

---

← Prev: [node:path](03-path.md) · Next → [node:url](05-url.md)
