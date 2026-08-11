---
title: "Secrets handling"
sidebar_label: "18 · Secrets"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** — every output below is from
> `sandbox/p8-security/ex17-secrets.mjs`.

A secret has two problems, and most teams only solve the first. **Getting it into the
process** is configuration. **Keeping it from leaving** is the part that shows up in a
paste of your logs.

## `--env-file`, exactly

Node reads `.env` files natively — no `dotenv`. What it does and does not parse:

```console
DB_PASSWORD=hunter2                 -> "hunter2"
QUOTED="with spaces"                -> "with spaces"        quotes stripped
SINGLE='single quoted'              -> "single quoted"
EMPTY=                              -> ""                   empty string, not undefined
SPACED = padded                     -> "padded"             both sides trimmed
export EXPORTED=yes                 -> "yes"                `export` prefix tolerated
MULTILINE="line1\nline2"            -> "line1\nline2"       real newline, decoded
# a comment                         -> ignored
NO_EQUALS_LINE                      -> undefined            skipped silently
EXPANDS=${DB_PASSWORD}-suffix       -> "${DB_PASSWORD}-suffix"
```

That last one is the trap: **there is no variable expansion**. `dotenv-expand` habits do
not carry over, and the failure is silent — you get a literal `${...}` in a connection
string and a confusing error from the database driver, not from Node.

**A real environment variable wins.** The file does not overwrite what the shell already
set:

```console
DB_PASSWORD=from-shell in the environment -> "from-shell"
nothing in the environment                -> "hunter2"
```

Which is the behaviour you want: the file is the developer default, and the deployment
platform's injected variables override it without anyone editing anything.

**A missing file is fatal, deliberately:**

```console
node --env-file /nope/.env app.js            -> node: /nope/.env: not found   (exit 9)
node --env-file-if-exists /nope/.env app.js  -> exit 0
```

Use `--env-file` for the file your app cannot start without, and `--env-file-if-exists`
for the optional local override. Silently starting with no configuration is how a service
comes up pointed at the wrong database.

`process.loadEnvFile(path)` does the same thing at runtime, and throws `ENOENT` when the
file is absent. It is the escape hatch for when you do not control the command line —
but it runs *after* module evaluation has begun, so any module that read `process.env` at
import time has already seen the old value.

## What `--env-file` is not

It is a **development convenience**, not a secret manager. The file is plaintext on disk,
readable by any process running as you, and has no rotation, no audit trail and no access
control. In production the secret should arrive from the platform — a secrets manager, an
injected environment, or a mounted file you read at boot — and the `.env` file should not
exist on that host at all. [Phase 11, page 01](../phase-11-deployment/01-twelve-factor-config.md)
covers the config side of that boundary.

## One real advantage over `export`

Values loaded from `--env-file` exist only in **this process's** `process.env`. They are
never written to the kernel's environment block:

```console
DB_PASSWORD in process.env   -> "hunter2"
DB_PASSWORD in /proc/self/environ -> undefined
SHELL_SECRET in /proc/self/environ -> "SHELL_SECRET=exported-value"
```

An exported shell variable is readable through `/proc/<pid>/environ` and `ps eww` for as
long as the process lives. One loaded from `--env-file` is not. The *path* still appears
in the command line, which is visible to everyone:

```console
cmdline -> /…/bin/node --env-file /tmp/…/.env
```

So never pass a secret as an argument — `node app.js --api-key=sk-live-…` publishes it to
every user on the box.

## Children inherit everything

`spawn`, `exec` and `fork` pass the whole environment down unless you say otherwise:

```console
default (env omitted):   child sees DB_PASSWORD: "hunter2"
explicit allowlist:      child sees DB_PASSWORD: undefined
```

An image-processing helper, a `git` call, a PDF renderer — each one gets your database
password by default, and each one can be made to print its environment. Pass
`{ env: { PATH: process.env.PATH } }` plus only what the child needs.

## How secrets actually escape

Not through an attacker. Through you:

```console
console.log(config)   -> { db: { host: 'db.internal', password: 'hunter2' }, apiKey: 'sk-live-abc123' }
JSON.stringify(config)-> {"db":{"host":"db.internal","password":"hunter2"},"apiKey":"sk-live-abc123"}
connection string     -> postgres://app:hunter2@db.internal:5432/app
```

**Errors are the worst offender**, because the habit of logging `err.message` hides how
much else is attached:

```console
e.message           -> connect failed
JSON.stringify(err) -> {"message":"connect failed","config":{"url":"postgres://app:hunter2@db.internal/app"}}
```

Database drivers, HTTP clients and ORMs routinely attach the request config — including
credentials — to the error they throw. Your logger serialises the whole object.

Two defences, and you want both.

**Redact on the way out**, in the logger, by key name:

```js
const REDACT = new Set(['password', 'apikey', 'token', 'secret', 'authorization', 'cookie']);
```

```console
redacted -> {"db":{"host":"db.internal","password":"[redacted]"},"apiKey":"[redacted]"}
```

A denylist misses the key you did not think of, so pair it with a URL scrubber for
`user:pass@host` and treat it as a safety net, not the design.
[Phase 10, page 04](../phase-10-observability/04-what-to-log.md) owns this from the
logging side.

**Make the value refuse to print itself**, which is the defence that does not rely on
anyone remembering:

```js
class Secret {
  #value;
  constructor(v) { this.#value = v; }
  expose() { return this.#value; }
  toString() { return '[redacted]'; }
  toJSON() { return '[redacted]'; }
  [util.inspect.custom]() { return 'Secret([redacted])'; }
}
```

```console
console.log      -> Secret([redacted])
template literal -> [redacted]
JSON.stringify   -> {"pw":"[redacted]"}
but .expose()    -> hunter2
```

Every accidental path — `console.log`, a template literal, a JSON logger, an error
attached as context — prints `[redacted]`. Only an explicit `.expose()` at the point of
use yields the value, and that call site is greppable in review.

## Git remembers

The reflex fix is wrong:

```console
working tree      -> .env gone
git log --all -S  -> 2 commit(s) still contain it
git show HEAD~1:.env -> API_KEY=sk-live-abc123
```

Deleting the file and adding `.gitignore` changes nothing about history. If the commit
was ever pushed, **the secret is compromised** — clones, forks, CI caches and the
provider's own dangling-commit storage all still have it.

The order is: **rotate first, rewrite second, and only if it is worth it.** Rotation is
the fix; `git filter-repo` or BFG is cleanup. Rewriting history invalidates every clone
and does not reach anyone who already pulled.

Prevent the next one with a `.gitignore` entry, a pre-commit secret scanner
(`gitleaks`, `trufflehog`), and provider-side push protection. All three are cheap
compared to a rotation.

## Rotation

A secret you cannot rotate in an afternoon is an outage waiting for its trigger. What
makes rotation practical:

- **Two valid at once.** The verifier accepts the old and new value during the overlap,
  so rotation is not a synchronised restart. This is why signing keys carry a `kid`.
- **Read at use, not at import.** `const key = process.env.API_KEY` at module top level
  freezes the value for the life of the process; a `getKey()` that reads when called
  lets a refresh land without a restart.
- **Rotate on a schedule, not on suspicion** — otherwise the first real rotation happens
  during the incident, untested.
- **Expiry beats revocation.** A credential that dies on its own needs no cleanup list.

## Gotchas

**Symptom:** A `.env` value arrives as the literal `${OTHER_VAR}-suffix`
**Cause:** `--env-file` does no variable expansion, unlike `dotenv-expand`. Verified.
**Fix:** Write the full value, or compose it in code after reading both variables.

**Symptom:** The app starts in production with default config and talks to the wrong host
**Cause:** `--env-file-if-exists` used where the file is mandatory; a missing file is not an error.
**Fix:** `--env-file` for required config (exit 9 if absent), and validate the parsed config at boot.

**Symptom:** A `.env` change has no effect until restart
**Cause:** `process.loadEnvFile()` ran after modules that had already captured `process.env` at import.
**Fix:** Load before requiring app code, or read the variable inside the function that uses it.

**Symptom:** The database password appears in an error-tracking service
**Cause:** Drivers attach the connection config to the error; loggers serialise the whole object.
**Fix:** Log named fields, never a whole error object; redact by key; use a `Secret` wrapper.

**Symptom:** `ps` shows the API key on a shared host
**Cause:** It was passed as a CLI argument; `/proc/<pid>/cmdline` is world-readable.
**Fix:** Environment or a file. `--env-file` values never reach `/proc/<pid>/environ` — verified.

**Symptom:** A helper subprocess was compromised and the database credentials went with it
**Cause:** `spawn` inherits the full environment by default.
**Fix:** Pass an explicit `env` allowlist to every child process.

**Symptom:** The secret was removed from the repo but the scanner still flags it
**Cause:** `git rm` plus `.gitignore` leaves every prior commit intact — verified, `git show HEAD~1:.env` returned it.
**Fix:** Rotate the credential. Treat history rewriting as optional cleanup afterwards.

## Interview questions

**★ What does `--env-file` give you over `dotenv`, and what does it not?**
No dependency, and values never enter the kernel environment block — verified,
`/proc/self/environ` had no trace while an exported variable did. It does not do variable
expansion, and a real environment variable always wins over the file. It is a development
convenience, not a secret manager.

**★ `--env-file` or `--env-file-if-exists`?**
`--env-file` for configuration the app cannot run without: a missing file exits 9, which
is what you want in CI and production. `--env-file-if-exists` for the optional developer
override. Starting quietly with no config is worse than failing to start.

**★ A secret was committed and pushed. What do you do first?**
Rotate it. Deleting the file and adding `.gitignore` leaves it in history — verified, two
commits still contained it after both. History rewriting is cleanup, and it never reaches
the clones, forks and CI caches that already have the value.

**★ How do secrets usually leak in a Node service?**
Through logs, not attackers. `console.log` of a config object, `JSON.stringify` of an
error that a driver attached the connection URL to, or a credential embedded in a
connection string. Redact by key in the logger, and wrap secrets in a type whose
`toString`, `toJSON` and `util.inspect.custom` all return `[redacted]`.

**Why pass an explicit `env` to child processes?**
Because the default is to inherit everything — verified, a child spawned with no `env`
option read `DB_PASSWORD`. A PDF renderer or an image tool has no business holding your
database credentials, and any subprocess can be made to dump its environment.

**What makes a secret rotatable?**
Two values valid at once during the overlap, reading the value at use rather than
capturing it at import, a schedule so the first rotation is not during an incident, and
expiry so credentials retire without a cleanup list.

---

← Prev: [Input validation](./17-input-validation.md) · Next → [HTTPS, HSTS and cookie flags](./19-https-hsts-cookies.md)
