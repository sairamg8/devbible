---
title: "Injection — SQL, NoSQL and command"
sidebar_label: "08 · Injection"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. The SQL and NoSQL figures were measured against
> PostgreSQL 17.10 and MongoDB 8.2.12 in
> [Phase 6, page 02](../phase-6-data-access/02-parameterized-queries.md); the command
> injection here was executed on this machine.

**Every injection is the same bug: data crossed into a position where it was read as
instructions.** The interpreter changes — SQL engine, Mongo query parser, the shell — the
mistake does not. Learn the shape once and you recognise all three on sight.

## The shape

```
trusted template  +  untrusted data  →  one string  →  an interpreter
```

The fix is never escaping. It is **never building that string** — send the code and the
data along separate channels, so the interpreter is told which is which.

## SQL

Measured in Phase 6: concatenating input into `where email = '${input}'` and sending
`x'; drop table sessions; --` **actually dropped the table**, because a `pool.query`
with no parameters uses the simple protocol and allows stacked statements. `x' or
'1'='1` returned all 500 rows; a `union all` returned session tokens.

```js
// no
await pool.query(`select * from users where email = '${email}'`);

// yes — $1 is data, and can never become a statement
await pool.query('select * from users where email = $1', [email]);
```

With `$1`, both hostile inputs returned **0 rows**.

**Placeholders cannot be identifiers.** `select * from $1` fails with
`42601 syntax error`. Where a table or column name genuinely must be dynamic, validate
against an allowlist you wrote — never against user input, however cleaned:

```js
const SORTABLE = new Set(['created_at', 'total_cents', 'status']);
if (!SORTABLE.has(sort)) throw new BadRequest('bad sort');
await pool.query(`select * from orders order by ${sort} desc limit $1`, [limit]);
```

ORMs and query builders parameterize their generated SQL, and every one of them has a
raw escape hatch that does not unless you use its tagged-template form
([Phase 6, page 13](../phase-6-data-access/13-prisma-drizzle.md)). Grep for `raw` and
`Unsafe` in review.

## NoSQL

MongoDB has no string to concatenate, which is why people assume it is immune. The
injection is **structural**: a JSON body deserialises into operators.

```js
// body: {"username":"admin","password":{"$ne":null}}
await users.findOne({username: req.body.username, password: req.body.password});
```

Measured: this **logged in as the admin user**. `{"$regex":"^h"}` confirms a password
prefix one character at a time, and `$where: 'this.username.length > 2'` executed
JavaScript server-side and returned both users.

```js
// coerce to the type you expect
await users.findOne({username: String(req.body.username), password: {$eq: String(req.body.password)}});
```

`{$eq: String(v)}` returned `null` for the hostile input. Better still, validate the
body's *shape* at the boundary so an object never reaches the query
([page 17](./17-input-validation.md)) — a schema that says `password: string` rejects
`{$ne: null}` before your query layer sees it.

## Command injection

The most damaging of the three, because the interpreter is the operating system.

```js
import {exec} from 'node:child_process';
await execP(`cat /etc/hostname ${userInput}`);       // userInput = 'report.txt; id'
```

```console
uid=1000(sairam) gid=1000(sairam) groups=1000(sairam),10(wheel) …
```

**`id` ran.** `exec` spawns a shell, so every shell metacharacter is live. All of these
executed:

```console
"a; id"      -> a / uid=1000(sairam) …
"a && id"    -> a / uid=1000(sairam) …
"a | id"     -> uid=1000(sairam) …
"a $(id)"    -> a uid=1000(sairam) …
"a `id`"     -> a uid=1000(sairam) …
"a\nid"      -> a / uid=1000(sairam) …
```

Six different syntaxes, including a bare newline. Any "escape the dangerous characters"
routine is a list you will get wrong.

**`execFile` takes an argument array and no shell**, so the same input stayed data:

```js
await execFileP('cat', ['/etc/hostname', userInput]);
```

```console
cat: 'report.txt; id': No such file or directory
```

The filename is absurd, and that is the point — it was treated as one filename, not as a
command.

**`shell: true` puts it straight back**, and Node 24 now says so:

```js
spawn('cat', ['/etc/hostname', userInput], {shell: true});
```

```console
(node:87495) [DEP0190] DeprecationWarning: Passing args to a child process with shell
option true can lead to security vulnerabilities, as the arguments are not escaped,
only concatenated.
uid=1000(sairam) …
```

An argument array with `shell: true` gives you the *appearance* of safety and the
behaviour of `exec`. Treat DEP0190 as an error in your own code.

| Call | Shell? | Safe with untrusted input |
|---|---|---|
| `exec` / `execSync` | Yes | **No** |
| `execFile` / `execFileSync` | No | Yes, with an args array |
| `spawn` (default) | No | Yes, with an args array |
| `spawn(..., {shell: true})` | Yes | **No** — DEP0190 |

And prefer not spawning at all: `fs.rm` beats `rm -rf`, a library beats shelling out to
`convert`. The safest shell command is the one you did not run.

## The pattern across all three

**Validate at the boundary** ([page 17](./17-input-validation.md)) so types are what you
think. **Parameterize** so data cannot become code. **Least privilege** so a successful
injection is limited — the application's database role should not own DDL
([Phase 6, page 11](../phase-6-data-access/11-migrations.md)), and the process should not
run as root.

## Gotchas

**Symptom:** A table disappeared
**Cause:** Concatenated SQL plus stacked statements on the simple protocol.
**Fix:** `$1` placeholders — a parameterized multi-statement is rejected outright with
`42601`.

**Symptom:** Login succeeds with the wrong password
**Cause:** A JSON body reached a Mongo filter as an operator (`{$ne: null}`).
**Fix:** Coerce with `String(...)` / `$eq`, and validate body shape at the boundary.

**Symptom:** Sorting by a user-supplied column breaks or leaks
**Cause:** Identifiers cannot be parameterized, so it was interpolated.
**Fix:** Allowlist of permitted column names.

**Symptom:** Shell commands run from a filename field
**Cause:** `exec` with interpolated input.
**Fix:** `execFile`/`spawn` with an args array and no shell.

**Symptom:** DEP0190 warning in the logs
**Cause:** `spawn(cmd, args, {shell: true})` — args are concatenated, not escaped.
**Fix:** Drop `shell: true`, or build the command with no untrusted parts.

**Symptom:** An escaping helper is bypassed by a newline
**Cause:** Denylisting metacharacters; `\n` is a command separator too.
**Fix:** Stop escaping. Use the channel that separates code from data.

**Symptom:** Injection through an ORM
**Cause:** `$queryRawUnsafe` / `sql.raw`.
**Fix:** The tagged-template forms parameterize; the `Unsafe` variants exist for
identifiers only.

## Interview questions

**★ What do SQL, NoSQL and command injection have in common?**
Untrusted data ended up in a position an interpreter reads as instructions, because code
and data were concatenated into one string. The fix in all three is the same: use an API
that carries them separately — placeholders, typed filters, an argument array — rather
than escaping.

**★ Why is escaping not the answer?**
Because it is a denylist of everything dangerous in someone else's grammar, and the
grammar is bigger than you think. Measured, six different shell constructs executed,
including a plain newline. Parameterization removes the question instead of answering it.

**★ How does NoSQL injection work without string concatenation?**
Structurally. A JSON body deserialises into query operators, so
`{"password":{"$ne":null}}` becomes a filter that matches any password — measured, it
logged in as admin. Coerce values to their expected type and validate the body's shape
so an object cannot arrive where a string belongs.

**★ What is the difference between `exec` and `execFile`?**
`exec` runs the command through a shell, so metacharacters in interpolated input are
interpreted — `'report.txt; id'` ran `id`. `execFile` takes an argument array with no
shell, so the same input was treated as one very strange filename. `shell: true` on
`spawn` reverts to `exec` behaviour and now emits DEP0190.

**How do you handle a dynamic column name if placeholders cannot be identifiers?**
Validate against an allowlist you control and interpolate only values from that set.
`pg.escapeIdentifier` exists for the cases where the set is genuinely open, but an
allowlist is preferable because it fails closed.

**What limits the damage when injection succeeds anyway?**
Least privilege. An application role without DDL rights cannot drop a table; a
non-root process cannot read arbitrary files. Injection defence is layered, and the
database role is the layer people forget.

---

← Prev: [MFA and TOTP](./07-mfa-totp.md) · Next → XSS and output encoding
