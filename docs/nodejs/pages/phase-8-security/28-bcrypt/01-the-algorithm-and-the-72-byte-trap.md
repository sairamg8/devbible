---
title: "bcrypt is a 60-character string that carries its own cost factor — and it silently ignores everything past the 72nd byte of your password"
sidebar_label: "01 · The algorithm and the 72-byte trap"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against **bcrypt 6.0.0** — the `node.bcrypt.js` README
> ([github.com/kelektiv/node.bcrypt.js](https://github.com/kelektiv/node.bcrypt.js)) and
> the npm registry metadata for the package. Target: **bcrypt 6.0.0** (published
> 2025-05-11), `engines: {"node": ">= 18"}`.
> Documentation-verified only — **the package is not installed in this checkout**, so
> nothing here was probed or timed. Claims the README does not settle are marked as
> unsettled rather than asserted.

**bcrypt is the password hash you will meet, not the one you would choose.** argon2id
and scrypt are both better answers for new code ([01 · Password storage](../01-password-storage.md)),
but bcrypt is in every legacy Node codebase written before about 2020, and the migration
path runs *through* understanding it. Two properties define it: the cost factor is stored
inside the hash, which is what makes upgrading possible at all — and it **silently
ignores input past 72 bytes**, which is what makes it dangerous in a way a fast hash
never is, because nothing fails.

## Why this is Understand and not Master

You need to know how it works, what its output means, and every way it bites — because
you will inherit it. You should not reach for it first. A page teaching bcrypt as the
default would be teaching the wrong default; `argon2id` is the current first choice and
`scrypt` is built into `node:crypto` with no native build to break.

⚠️ In a codebase that already stores bcrypt hashes, this is effectively **Master** — you
cannot safely touch the login path without it.

## Anatomy of the output

A bcrypt hash is a self-describing string. The README states the format is
`$[algorithm]$[cost]$[salt][hash]`, that hashes are **60 characters**, and that the
algorithm prefix is either `$2a$` or `$2b$`.

```text
$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyQ8/8pFPjPCEG
└┬┘└┬┘ └───────────────────┬──────────────────────────────┘
 │  │                      └─ 22 chars of encoded salt, then 31 of hash
 │  └─ cost factor: 12 means 2¹² iterations
 └─ algorithm version
```

Four consequences worth holding onto:

**The salt is inside the string.** You do not store it separately, and you do not pass it
to `compare()` — the function reads it back out of the stored hash. This is why bcrypt
verification takes the hash rather than a salt plus a hash.

**The cost is inside the string too.** That is what makes a cost upgrade possible: an old
hash still verifies at its own cost, and you rewrite it at the new cost the next time you
hold the plaintext. Same mechanism as the `scheme$params$salt$hash` shape on
[01 · Password storage](../01-password-storage.md) — bcrypt just standardised it first.

**60 characters, always.** So the database column is `CHAR(60)`, not `VARCHAR(255)`
guessed at. A `VARCHAR(50)` column silently truncating hashes on write is a real
production failure: every login fails, and the stored value looks almost right.

**The cost factor is an exponent, not a multiplier.** Cost 12 is 2¹² iterations; cost 13
is **twice** the work of 12, not 8% more. Raising it by one doubles your login CPU.

### `$2a$` vs `$2b$`

The prefix identifies the algorithm revision, and both are valid input — the README names
both. `$2b$` exists because an older implementation had a defect in how it handled long
inputs, and the prefix was bumped so the two behaviours could coexist in one password
table.

⚠️ **What the README does not settle** is exactly which prefix this library emits on a
given version, or the precise defect history behind `$2a$`. Do not assert either from
memory. What matters operationally is settled and sufficient: **verification accepts both,
so a table holding a mix of prefixes is normal and does not need migrating.**

## 🔴 The 72-byte truncation

This is the one thing everyone gets wrong about bcrypt, and the README is unambiguous:

> *"Only the first 72 bytes of a string are used. Any extra bytes are ignored when
> matching passwords."*

**Bytes. Not characters.** That distinction is the whole gotcha, because Node strings are
UTF-8 encoded on the way in and non-ASCII characters cost more than one byte each:

```js
const len = (s) => Buffer.byteLength(s, 'utf8');

len('a'.repeat(72));      // 72 — exactly at the limit
len('é'.repeat(72));      // 144 — half of it is ignored
len('🔒'.repeat(18));      // 72 — eighteen emoji is the whole budget
```

A user with a 40-character passphrase in Japanese, or a password manager generating 80
random ASCII characters, is past the limit — and **nothing anywhere reports it.** The
hash succeeds, the login succeeds, and the effective password is a prefix of what they
typed.

### Why it is a security bug and not a curiosity

Two users whose passwords share the first 72 bytes have **the same effective password**.
Given a password manager that generates a long common prefix — a URL, a site name, a
fixed pattern — the entropy past byte 72 contributes nothing at all. The user believes
they have a 100-character password; they have a 72-byte one.

It also breaks the intuition that longer is safer. Advising users to "use a long
passphrase" while running bcrypt is advice your storage layer quietly declines to honour.

### The three ways out, and their costs

**1 · Use argon2id or scrypt instead.** No limit, and both are better hashes. This is the
right answer for anything new — see [01 · Password storage](../01-password-storage.md).

**2 · Pre-hash to a fixed length, deliberately.** Run the password through SHA-256 first,
then bcrypt the digest, so no input ever exceeds the budget:

```js
import {createHash} from 'node:crypto';
import bcrypt from 'bcrypt';

// The base64 digest is 44 ASCII characters — always under 72 bytes.
const prehash = (password) =>
  createHash('sha256').update(password.normalize('NFKC'), 'utf8').digest('base64');

export const hashPassword    = (pw)         => bcrypt.hash(prehash(pw), 12);
export const verifyPassword  = (pw, stored) => bcrypt.compare(prehash(pw), stored);
```

🔴 **Both sides must pre-hash, forever.** The moment one call site forgets, that user
cannot log in — and it will be the password-reset path, not the login path, that forgets.
Put both behind one module and never call `bcrypt` directly anywhere else.

⚠️ Pre-hashing is a **deliberate, documented** decision, not a default. It changes what
is stored, so it cannot be introduced to an existing table without a migration: old
hashes were made from the raw password, new ones from the digest, and they are not
interchangeable. Adopt it at the same moment you adopt a `scheme` marker.

**3 · Cap the password length in validation.** Reject over 72 bytes at the boundary with
an honest message. The cheapest option, and the worst — it tells users their long,
correct password is invalid, which trains exactly the wrong behaviour. Use it only as a
stopgap while migrating.

⚠️ **Do not "fix" this by truncating in your own code.** You gain nothing — bcrypt
already ignores the tail — and you make the limit invisible in a second place.

## The version boundary at 5.0.0

The README is explicit that versions **before 5.0.0** are not merely older, they are
wrong in two ways: they *"truncate passwords >= 255 characters"* and do not *"handle NUL
characters inside passwords properly."*

This makes `bcrypt@<5` an **upgrade boundary, not a version number**:

- A password containing a NUL byte may hash differently before and after the upgrade,
  so those users cannot log in afterwards.
- A password of 255+ characters was truncated at a different point than 72.

🔴 **Check the installed major before touching a legacy login path.** `npm ls bcrypt` is
the first command to run in any codebase you did not write. If it is below 5, the upgrade
is a migration with a user-visible failure mode — plan a rehash-on-login window and a
support path for the accounts that break, rather than shipping the bump on a Friday.

## Gotchas

**★ Symptom: a user's long passphrase works, but so does a shorter prefix of it.**
Cause: bcrypt used only the first 72 bytes; everything after is ignored on both hash and
compare. Fix: move to argon2id/scrypt, or pre-hash deliberately as above. There is no
configuration that raises the limit.

**★ Symptom: non-ASCII passwords fail sooner than expected.** Cause: the limit is 72
**bytes**, and UTF-8 multibyte characters spend the budget faster — `'é'.repeat(72)` is
144 bytes. Fix: measure with `Buffer.byteLength(pw, 'utf8')`, never `pw.length`, whenever
you reason about the limit at all.

**★ Symptom: every login fails after a deploy, and the stored hashes look almost right.**
Cause: the column is narrower than 60 characters and the database truncated on write.
Fix: `CHAR(60)`. Verify existing rows with a length check before assuming the code broke.

**★ Symptom: raising the cost factor by two makes logins four times slower.** Cause: cost
is an exponent — 2^rounds. Fix: raise it one step at a time and re-measure your login
throughput at each step, on deploy hardware.

**★ Symptom: users created before an upgrade cannot log in afterwards.** Cause: the
project was on `bcrypt@<5`, which mishandles NUL bytes and truncates at 255 characters —
the README names both. Fix: treat any upgrade across 5.0.0 as a migration with a
rehash-on-login window, not a dependency bump.

**★ Symptom: a table contains both `$2a$` and `$2b$` hashes and someone proposes a
migration.** Cause: the prefix is the algorithm revision and both are accepted on
verification. Fix: leave them alone. There is nothing to migrate; a rewrite risks
locking users out for no benefit.

**Symptom: a pre-hashing scheme is added and password reset stops working.** Cause: one
call site hashes the raw password while the rest pre-hash. Fix: one module owns both
`hashPassword` and `verifyPassword`; nothing else imports `bcrypt`.

## Interview questions

**★ What is the 72-byte limit, and why is "byte" the important word?**
bcrypt uses only the first 72 bytes of the input and silently ignores the rest — the
README says so outright. "Byte" matters because Node encodes strings as UTF-8, so a
non-ASCII character costs two to four bytes: 72 accented characters is 144 bytes, and
eighteen emoji is the entire budget. The failure is silent on both hash and compare, so
two passwords sharing a 72-byte prefix are the same password as far as your system is
concerned. That is why a long-passphrase policy and bcrypt are quietly incompatible.

**★ Why can bcrypt raise its cost factor later when a bare hash cannot?**
Because the cost is stored inside the 60-character output, alongside the salt and the
algorithm version. An old hash therefore still verifies at the cost it was created with,
and you rewrite it at the new cost the next time you legitimately hold the plaintext —
at login. A scheme that keeps its parameters in application code cannot do this: change
the constant and every existing hash becomes unverifiable, and you cannot recompute them
in bulk because you do not have the plaintexts.

**★ A colleague proposes pre-hashing with SHA-256 before bcrypt. Is that a good idea?**
It is a legitimate and standard way to escape the 72-byte limit, but it is a decision
with consequences, not a free fix. Both hashing and verification must pre-hash forever,
so it belongs behind a single module. It cannot be retrofitted to an existing table
without a migration, because old hashes were computed from the raw password and new ones
from the digest. And it does not make bcrypt a better hash — if you are free to choose,
argon2id or scrypt is the better answer.

**★ You inherit a codebase on `bcrypt@4`. What do you check before upgrading?**
Whether any stored password contains a NUL byte or was 255 characters or longer, because
the README states versions before 5.0.0 mishandle both — meaning affected users will fail
to log in after the upgrade. It is a data migration with a user-visible failure mode, so
it needs a rehash-on-login window and a support path for locked-out accounts, not a
Friday dependency bump.

**Why is a bcrypt hash always exactly 60 characters, and why does that matter?**
The format is fixed: a version prefix, a two-digit cost, 22 characters of encoded salt
and 31 of hash. It matters because it sizes the database column. A column narrower than
60 truncates on write, and the stored value still looks like a bcrypt hash — so every
login fails while the data looks superficially correct.

**Does bcrypt need a separate salt column?**
No. The salt is generated per hash and embedded in the output string, which is why
`compare()` takes the password and the stored hash and nothing else — it reads the salt
back out. Storing a salt separately alongside bcrypt is a sign someone has confused it
with a raw-hash scheme.

---

← [Topic index](README.md) · Next → [Using it safely in Node](02-using-it-safely-in-node.md)
