---
title: "util.parseArgs"
sidebar_label: "22 · util.parseArgs"
sidebar_position: 22
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Stable since v20.

**Zero-dependency CLI option parsing over `process.argv`. It covers long and short
flags, `=` syntax, repeated options, defaults and positionals. Reach for
`commander` when you need subcommands and generated help — not before.**

```js
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    port:    { type: 'string',  short: 'p', default: '3000' },
    verbose: { type: 'boolean', short: 'v', default: false },
    tag:     { type: 'string',  multiple: true, default: [] },
    help:    { type: 'boolean' },
  },
  allowPositionals: true,
});
```

```console
$ node args.mjs -p 8080 -v --tag a --tag b deploy prod
values     : {"port":"8080","verbose":true,"tag":["a","b"]}
positionals: ["deploy","prod"]

$ node args.mjs --port=9000 --tag=x file.txt
values     : {"port":"9000","tag":["x"],"verbose":false}
positionals: ["file.txt"]
```

Both `--port 9000` and `--port=9000` work, short flags work, and `multiple: true`
collects repeats into an array. It reads `process.argv.slice(2)` by default; pass
`args` to parse something else, which is what makes it testable.

## The rules worth knowing

| | |
|---|---|
| `type` | **Required** — `'string'` or `'boolean'`. There is no `'number'`; coerce and validate yourself |
| `default` | Applied when the flag is absent. A `multiple` option should default to `[]` |
| `allowPositionals` | **`false` by default** — bare arguments throw unless you enable it |
| `strict` | `true` by default: unknown options throw `ERR_PARSE_ARGS_UNKNOWN_OPTION` |
| `tokens: true` | Returns the raw token stream for custom handling |
| `allowNegative` | Lets `--no-verbose` set a boolean to `false` |

```console
$ node args.mjs --unknown
node:internal/util/parse_args/parse_args:102
      throw new ERR_PARSE_ARGS_UNKNOWN_OPTION(
```

Strict mode throwing on a typo is the behaviour you want — the alternative is a
script that silently ignores `--dry-run` and does the real thing. Catch it and
print usage:

```js
let parsed;
try {
  parsed = parseArgs({ options, allowPositionals: true });
} catch (err) {
  console.error(err.message);
  console.error(USAGE);
  process.exit(64);                      // EX_USAGE
}
if (parsed.values.help) { console.log(USAGE); process.exit(0); }
```

**There is no generated help.** `USAGE` is a template literal you maintain by
hand, and it is the main thing you give up versus a library.

Everything is a string, including numbers, so validate at the edge:

```js
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`invalid --port: ${values.port}`);
  process.exit(64);
}
```

## Where it fits

Good for a one-command tool: a migration runner, a seed script, a maintenance
task, a build helper. Anything already in your repo that currently does
`process.argv[2]` should use this instead.

Reach for `commander` or `yargs` when you need **subcommands**
(`mytool db migrate`), generated `--help`, or shell completions. Reimplementing
those over `parseArgs` costs more than the dependency saves.

For an application rather than a CLI, remember the division of labour: **flags
are for invocation, environment variables are for configuration**
([page 15](15-process.md)). Secrets in particular belong in `env`, never in argv —
`process.argv` is visible to any user who can run `ps`.

Two related Node features complete the picture without dependencies: `--env-file`
loads a dotenv file, and `--watch` reruns on change
([Phase 0](../phase-0-runtime-model/08-running-node.md)).

## Gotchas

**Symptom:** `ERR_PARSE_ARGS_UNKNOWN_OPTION` on a valid-looking flag
**Cause:** It is not declared in `options`; strict mode rejects unknowns.
**Fix:** Declare it, or catch the error and print usage.

**Symptom:** Bare arguments throw
**Cause:** `allowPositionals` defaults to `false`.
**Fix:** Set it to `true`.

**Symptom:** `values.port` compares wrong against a number
**Cause:** `type: 'string'` yields a string; there is no numeric type.
**Fix:** Coerce and validate.

**Symptom:** Only the last `--tag` survives
**Cause:** `multiple: true` was not set.
**Fix:** Set it, and default to `[]`.

**Symptom:** A negated flag is not recognised
**Cause:** `--no-x` needs `allowNegative`.
**Fix:** Enable it, or declare a separate flag.

**Symptom:** A secret passed as `--token` shows up in `ps` output
**Cause:** Command lines are world-readable.
**Fix:** Pass secrets through the environment or a file.

## Interview questions

**★ Why use `parseArgs` instead of `commander`?**
It is in core, so no dependency, no supply-chain surface and no install step, and
it covers long and short flags, `=` syntax, repeats, defaults and positionals.
Stable since v20. The trade is no subcommands and no generated help.

**★ What does strict mode do?**
Throws `ERR_PARSE_ARGS_UNKNOWN_OPTION` on an undeclared option instead of ignoring
it. That turns a mistyped `--dry-run` into an error rather than a script that
quietly performs the real operation.

**★ Why is there no number type?**
The API stays deliberately small — everything is a string or a boolean, and
coercion plus range validation is left to you. Skipping that step is how `--port`
ends up compared as a string.

**★ Flags or environment variables for configuration?**
Flags describe one invocation — which file, which mode, dry run. Environment
variables describe the deployment — database URL, log level, secrets. Secrets in
particular must not be in argv, since command lines are visible via `ps`.

**How do you parse arguments in a test?**
Pass an explicit `args` array instead of letting it read `process.argv`. The
function is otherwise pure.

**When is a CLI library actually justified?**
Subcommands, generated help and completions. Building those on `parseArgs` costs
more than the dependency.

---

← Prev: [IPC](21-ipc.md) · Next → [cluster](23-cluster.md)
