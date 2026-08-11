---
title: "Running node"
sidebar_label: "08 · Running node"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Every flag on this page is
> stable in Node 24 — `--env-file` and `--env-file-if-exists` shed their
> experimental label in **v24.10.0**, so make sure you are on 24.10 or later.

**The `node` binary does more than execute a file. Modern Node replaces
`nodemon`, `dotenv` and a scratch file with built-in flags.**

## Argument order matters

```console
node [node flags] script.js [your app's arguments]
```

Everything **before** the filename configures Node. Everything **after** it
belongs to your program:

```js
// args.js
console.log(process.argv.slice(2), process.execArgv);
```

```console
$ node --trace-warnings args.js --port 3000
[ '--port', '3000' ] [ '--trace-warnings' ]

$ node args.js --port 3000 --watch
[ '--port', '3000', '--watch' ] []      # ⚠ --watch is NOT active
```

In the second command `--watch` came after the filename, so Node handed it to
your script as plain text and ignored it. No error, no warning — the flag just
silently does nothing. `process.execArgv` holds the flags Node itself received,
which is how you check.

## `--watch` — nodemon, built in

> Added v18.11.0 · Stability: **2 – Stable**

```console
$ node --watch server.js
```

```console
ran at 2026-08-09T14:45:13.600Z
Completed running 'server.js'. Waiting for file changes before restarting...
Change detected in '/home/you/app/server.js'
Restarting 'server.js'
ran at 2026-08-09T14:45:15.737Z
```

Node restarts the process when any file it has *imported* changes. Related flags:

| Flag | Use |
|---|---|
| `--watch-path=./src` | Watch specific directories instead of just the imported graph |
| `--watch-preserve-output` | Stop clearing the terminal on each restart |

The trade-off against `nodemon`: no extra dependency and it understands the real
module graph, but fewer knobs — no debounce tuning, no custom "run this command"
behaviour. For a normal API server it is enough.

## `--env-file` — dotenv, built in

> Added v20.6.0 · No longer experimental as of **v24.10.0 / v22.21.0** ·
> Stability: **2 – Stable**

```bash
# .env
DB_URL=postgres://localhost/app
PORT=8080
# a comment
GREETING="hello there"
```

```console
$ node --env-file=.env readenv.js
postgres://localhost/app
8080
hello there

$ node readenv.js
undefined
undefined
undefined
```

Three behaviours worth knowing, all verified:

1. **A variable already in the environment wins.** `PORT=3000 node
   --env-file=.env app.js` gives you `3000`, not the file's `8080`. Real
   environment beats file — which is what you want in production.
2. **No variable expansion.** `B=$A/two` stays the literal string `$A/two`.
   `dotenv-expand` does this; Node does not.
3. **A missing file is a hard error** — `node: .env: not found`, non-zero exit.
   Use `--env-file-if-exists=.env` when the file is optional:
   `.env not found. Continuing without it.`

Put both in your scripts and the dev loop needs no dependencies at all:

```json
{
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.js"
  }
}
```

## `NODE_OPTIONS`

Flags you cannot put on the command line — because a tool, a container, or a
package manager launches `node` for you.

```console
$ NODE_OPTIONS='--max-old-space-size=4096' npm test
```

- Command-line flags **take precedence** over `NODE_OPTIONS`.
- Not every flag is allowed. Anything that decides *what to run* is rejected:

```console
$ NODE_OPTIONS='--eval "1"'      node app.js
node: --eval is not allowed in NODE_OPTIONS

$ NODE_OPTIONS='--print "1"'     node app.js
node: --print is not allowed in NODE_OPTIONS

$ NODE_OPTIONS='--env-file=.env' node app.js
node: --env-file= is not allowed in NODE_OPTIONS

$ NODE_OPTIONS='--test'          node app.js
node: --test is not allowed in NODE_OPTIONS
```

Resource and diagnostic flags — `--max-old-space-size`, `--enable-source-maps`,
`--trace-warnings`, `--import` — are allowed, and those are the ones you
actually want here.

## `--run` — script runner without npm

> Added v22.0.0 · Stability: **2 – Stable**

```console
$ node --run greet
2
```

Runs a script from `package.json` with far less startup overhead than
`npm run`. The trade-off: it deliberately does **not** run `pre`/`post` scripts
and does not carry npm's wider behaviour. Fine for `build` and `test`; check
before swapping it into a chain that depends on `pretest`.

## The REPL and one-off evaluation

```console
$ node
Welcome to Node.js v24.19.0.
Type ".help" for more information.
> const { readFile } = require('node:fs/promises')
undefined
> (await readFile('.nvmrc', 'utf8')).trim()     // top-level await works
'24'
> _                                             // _ is the last result
'24'
> .exit
```

Useful REPL commands: `.editor` for multi-line input, `.load file.js`,
`.save session.js`, `.exit`. Tab completion works on any object.

For a single expression, skip the REPL:

```console
$ node -e "console.log(1 + 1)"      # --eval: run this code
2
$ node -p "process.version"         # --print: run it AND print the result
v24.19.0
$ node -p "require('node:os').platform()"
linux
```

`-p` is `-e` plus an automatic `console.log` of the value — the quickest way to
ask Node a question.

Syntax-check a file without running it:

```console
$ node --check bad.js
/home/you/app/bad.js:1
const x = ;
          ^

SyntaxError: Unexpected token ';'
```

## Gotchas

**Symptom:** `--watch` (or any flag) appears to do nothing
**Cause:** It was written after the script name, so it went into `process.argv`
as an ordinary argument.
**Fix:** Put Node flags before the filename. Confirm with `process.execArgv`.

**Symptom:** `--env-file` values are ignored in production
**Cause:** Those variables are already set in the real environment, which takes
priority.
**Fix:** This is the correct behaviour — the deployed environment should win.
Only use `.env` for local development.

**Symptom:** `node: .env: not found` crashes the container on boot
**Cause:** `--env-file` requires the file to exist; production ships without one.
**Fix:** `--env-file-if-exists`.

**Symptom:** `${OTHER_VAR}` shows up literally in a value
**Cause:** Node's `.env` parser does not expand variables.
**Fix:** Write the full value out, or compose it in code from the parts.

**Symptom:** `NODE_OPTIONS='--test'` fails with "not allowed"
**Cause:** Flags that change *what* gets executed are blocked from the
environment, deliberately — otherwise an inherited variable could make every
`node` invocation on the machine run something else.
**Fix:** Pass those on the command line.

**Symptom:** A memory flag set in `NODE_OPTIONS` seems to be ignored
**Cause:** A command-line flag of the same name overrides it, or the tool spawns
a fresh process that strips the environment.
**Fix:** Check `process.execArgv` inside the process to see what actually
arrived.

## Interview questions

**★ Why must Node flags come before the script name?**
Node stops treating arguments as its own at the first non-flag argument — the
script path. Everything after it is forwarded to your program in `process.argv`.
A misplaced flag is silently ignored rather than rejected, which is what makes it
a nasty bug.

**★ What replaced `nodemon` and `dotenv` in modern Node?**
`--watch` (stable, added v18.11.0) and `--env-file` (stable as of v24.10.0 /
v22.21.0). Both cover the common case with no dependency; the packages still win
on configurability and on variable expansion.

**★ What is `NODE_OPTIONS` for, and why are some flags forbidden in it?**
It passes flags to a Node process you do not launch directly — under `npm`, a
test runner, or a container. Flags that determine what code runs (`--eval`,
`--print`, `--test`, `--env-file`) are rejected because an inherited environment
variable could otherwise hijack every Node process on the machine.

**If `--env-file` sets `PORT=8080` and the environment already has
`PORT=3000`, which wins?**
The environment: `3000`. The file only fills in what is not already set, so a
real deployment's configuration is never overwritten by a stray `.env`.

**What is the difference between `node -e` and `node -p`?**
`-e` runs the code and prints nothing; `-p` runs it and prints the resulting
value. `node -p "process.version"` is a one-line version check.

**How would you check a file for syntax errors without executing it?**
`node --check file.js`. Useful in a pre-commit hook or when validating generated
code.

---

← Prev: [Choosing a version](07-choosing-a-version.md) · Next → [Node vs Deno vs Bun](09-node-deno-bun.md)
