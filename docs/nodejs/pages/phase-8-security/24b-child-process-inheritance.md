---
title: "A spawned Node child inherits the parent's permission flags unless it states its own policy, and a non-Node child is not held to them at all — so --allow-child-process is an accident guard, never a boundary"
sidebar_label: "24b · Child-process inheritance"
sidebar_position: 24.5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-10-08 on **Node 24.19.0** against the Node.js docs for v24 — [`--allow-child-process`](https://nodejs.org/docs/latest-v24.x/api/cli.html#--allow-child-process)
> (its `changes:` entry for v24.4.0, read from the [v24.19.0 source](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md)),
> [Permission Model](https://nodejs.org/docs/latest-v24.x/api/permissions.html), [`process.execArgv`](https://nodejs.org/docs/latest-v24.x/api/process.html#processexecargv),
> the v24.19.0 source of [`lib/child_process.js`](https://github.com/nodejs/node/blob/v24.19.0/lib/child_process.js) and
> [`lib/internal/process/pre_execution.js`](https://github.com/nodejs/node/blob/v24.19.0/lib/internal/process/pre_execution.js), the same
> [`lib/child_process.js` at v24.18.1](https://github.com/nodejs/node/blob/v24.18.1/lib/child_process.js) for the before/after of #63972, and
> [CHANGELOG_V24.md](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md) (24.4.0, 24.19.0).
> The source was read, not executed: **no sandbox run**, and the `js` fences are illustrative. Parent page: [24 · The Permission Model](24-permission-model.md).

**`--allow-child-process` does not discard the model on Node 24: since v24.4.0 a spawned Node child is started with the
parent's permission flags. But that copy is a convenience, not a boundary. It is skipped when the child already names its
own `--permission`, it forwards only flags found in `process.execArgv`, and in 24.18.1 an unrelated `NODE_OPTIONS`
value could switch it off. A non-Node child is not constrained at all. This page reads the mechanism out of the source so you
can tell which of those you are exposed to.**

## What the docs promise

The flag's own history entry records the change ([#58853](https://github.com/nodejs/node/pull/58853), v24.4.0):

> *"When spawning process with the permission model enabled. The flags are inherit to the child Node.js process through NODE_OPTIONS environment variable."*

and the body of the section says how, per API:

> *"The `child_process.fork()` API inherits the execution arguments from the parent process. This means that if Node.js is started with the Permission Model enabled and the `--allow-child-process` flag is set, any child process created using `child_process.fork()` will automatically receive all relevant Permission Model flags."*

> *"This behavior also applies to `child_process.spawn()`, but in that case, the flags are propagated via the `NODE_OPTIONS` environment variable rather than directly through the process arguments."*

(Source: [`--allow-child-process`](https://nodejs.org/docs/latest-v24.x/api/cli.html#--allow-child-process), v24.19.0 text.)
Those sentences are silent on what happens when the child is given its own permission flags, when `env` is replaced, and
what a non-Node binary does with a `NODE_OPTIONS` variable. For those the source is the only authority below. The runtime
is blunt about the flag itself: `initializePermission()` in `lib/internal/process/pre_execution.js` (v24.19.0) emits a
`SecurityWarning` for each of `--allow-addons`, `--allow-child-process`, `--allow-inspector`, `--allow-wasi` and
`--allow-worker` that is set, with this text (the flag name substituted in):

> *"The flag --allow-child-process must be used with extreme caution. It could invalidate the permission model."*

and the Permission Model page states the scope it is claiming:

> *"The permission model implements a "seat belt" approach, which prevents trusted code from unintentionally changing files or using resources that access has not explicitly been granted to. It does not provide security guarantees in the presence of malicious code. Malicious code can bypass the permission model and execute arbitrary code without the restrictions imposed by the permission model."*

## What the source does with it

`spawn()` and `spawnSync()` both build the child's argv and environment in `normalizeSpawnArguments`, and `fork()` ends in a
call to `spawn()`. With the model on, that function makes one call (v24.19.0, `lib/child_process.js`):

```js
  if (permission.isEnabled()) {
    copyPermissionModelFlagsToEnv(env, 'NODE_OPTIONS', args);
  }
```

and the function it calls, verbatim:

```js
function copyPermissionModelFlagsToEnv(env, key, args) {
  // Do not override if permission was already passed to file
  if (args.includes('--permission') || args.includes('--permission-audit') ||
      hasPermissionFlagInEnv(env[key])) {
    return;
  }

  const flagsToCopy = getPermissionModelFlagsToCopy();
  for (const arg of process.execArgv) {
    for (const flag of flagsToCopy) {
      if (arg.startsWith(flag)) {
        env[key] = `${env[key] ? env[key] + ' ' + arg : arg}`;
      }
    }
  }
}
```

`getPermissionModelFlagsToCopy()` returns `[...permission.availableFlags(), '--permission']`, and `availableFlags()` is the
seven `--allow-fs-read`, `--allow-fs-write`, `--allow-addons`, `--allow-child-process`, `--allow-inspector`, `--allow-wasi`
and `--allow-worker`. The `--permission-audit` test is in the 24.19.0 source, but the flag itself is listed in
CHANGELOG_V24.md under 24.20.0 and is not in the 24.19.0 CLI docs, so nothing on this page depends on it.

`fork()` reaches the same function by a different route: it builds `args = [...execArgv, modulePath, ...args]` from
`options.execArgv || process.execArgv`, so `--permission` is already in `args`, the guard returns at once, and the flags
travel as arguments, which is the docs' "inherits the execution arguments". Everything below is a consequence of those two
functions.

```js
// run as: node --permission --allow-child-process --allow-fs-read=/app app.mjs
import { fork, spawn } from 'node:child_process';

// Node children that state no policy: the parent's flags travel with them (v24.4.0+).
fork('/app/job.mjs');                          // flags ride in the argument list
spawn(process.execPath, ['/app/job.mjs']);     // flags are appended to NODE_OPTIONS

// Node children that state their own policy: the guard returns before copying anything,
// so the parent's --allow-* flags are not applied and these flags decide.
spawn(process.execPath, ['--permission', '--allow-fs-read=*', '/app/job.mjs']);
fork('/app/job.mjs', [], { execArgv: ['--permission', '--allow-fs-read=*'] });

// A non-Node child: not constrained by any Node flag.
spawn('sh', ['-c', 'cat /etc/hostname']);
```

## When a Node child does not inherit

**1 · The child names its own policy.** The guard's comment, *"Do not override if permission was already passed to file"*,
marks an early `return` when the child's `args` contain `--permission`, or when the `NODE_OPTIONS` of the env being used
already contains it as a token. The child then runs under its own `--allow-*` flags only, and the OS-level rights of the same
user are the only ceiling. Any code path that lets a caller influence the argument list before the script name, the
`execArgv` option, or the `env` object reaches this branch, so a process holding `--allow-child-process` can start a Node
runtime with a wider policy than its own.

**2 · The copy reads `process.execArgv` and nothing else.** The docs describe that array as *"the set of Node.js-specific
command-line options passed when the Node.js process was launched"*. A grant that reached the parent through `NODE_OPTIONS`,
or through the `permission` object of a config file (see [page 24](24-permission-model.md)), is not an entry in it. The
default environment, `options.env || { ...process.env }`, already carries `NODE_OPTIONS` down, which is why the guard looks
there first. A custom `env` replaces that object, so, reading the code, a parent started wholly through `NODE_OPTIONS`,
spawning with a custom `env` that lacks it, forwards nothing, and the child starts with no model at all; and a parent whose
grants came from a config file forwards `--permission` (it is in `execArgv`) but not the grants (they are not `--allow-*`
entries), so the child comes up with the model on and no grants of its own. Both are readings of the code, not runs. Test
your own spawn path.

**3 · In 24.18.1 an unrelated `NODE_OPTIONS` value could switch it off.** The v24.19.0 changelog lists
*"child_process: fix permission model propagation via NODE_OPTIONS"* ([#63972](https://github.com/nodejs/node/pull/63972)).
Diffing `lib/child_process.js` between v24.18.1 and v24.19.0 shows what changed. The guard in 24.18.1 was:

```js
  if (args.includes('--permission') || (env[key] && env[key].indexOf('--permission') !== -1)) {
```

a substring test. Any `NODE_OPTIONS` value that merely contained the text `--permission` suppressed the copy, and the child
started without the model. The new helper's comment gives the example:

> *"We use exact token matching rather than substring matching to avoid false positives when unrelated option values contain '--permission' (e.g., --title=--permission)."*

Only v24.18.1 was compared, so how far back the substring test goes is not established here.

## A non-Node child

`copyPermissionModelFlagsToEnv` runs for every spawn whatever binary is named, so `sh`, `curl` and `python` also receive the
`NODE_OPTIONS` variable. They do not act on it, and nothing in Node constrains them: they are ordinary OS processes with the
parent's OS-level rights. A Node runtime they start in turn would read the variable and come up under the flags, unless the
command line strips it first, which `sh -c` can do. The docs do not spell this out; it follows from the mechanism.

## Gotchas

**Symptom:** A child process reads a file the parent was denied, with `--allow-child-process` granted
**Cause:** The child is a non-Node binary (`sh`, `cat`, `curl`, `python`). The permission flags are enforced by the Node runtime that reads them, and a binary that is not Node never does.
**Fix:** Do the work in-process, where the model applies. A denied read then throws instead of succeeding:

```js
import { readFile } from 'node:fs/promises';

// was: spawn('cat', ['/app/data/hostname.txt'])  -- outside the model
const hostname = await readFile('/app/data/hostname.txt', 'utf8');   // checked against --allow-fs-read
```

**Symptom:** A spawned Node child reads paths the parent's `--allow-fs-read` does not cover
**Cause:** The child was started with its own `--permission` in its argument list, its `execArgv` option or its `NODE_OPTIONS`, so the guard returned and the parent's flags were never applied. Caller-controlled input is the usual route in.
**Fix:** Keep caller data after the script name, where Node does not parse it as an option, build `env` yourself rather than from caller input, and state the child's policy in its argument list:

```js
import { spawn } from 'node:child_process';

// Everything after the script name lands in the script's process.argv; it cannot become a Node option.
// The child's policy is written here and does not depend on inheritance.
// NODE_OPTIONS is left out of the child's env on purpose: the docs do not say whether --allow-*
// values there and on the command line add up, so the argument list is made the whole policy.
const { NODE_OPTIONS, ...env } = process.env;
spawn(
  process.execPath,
  ['--permission', '--allow-fs-read=/app/jobs', '/app/jobs/resize.mjs', userSuppliedName],
  { env: { ...env, JOB: 'resize' } },
);
```

The `process.execArgv` docs show the rule: with `node --icu-data-dir=./foo --require ./bar.js script.js --version`, only the three tokens before `script.js` are Node options, and `--version` stays in `process.argv`.

**Symptom:** A spawned Node child has no `process.permission` and reads freely
**Cause:** On 24.18.1 (the version compared; older ones were not checked) a `NODE_OPTIONS` value containing the substring `--permission` made the parent skip the copy ([#63972](https://github.com/nodejs/node/pull/63972), fixed in 24.19.0). Nothing failed; the child just ran without the model.
**Fix:** Run 24.19.0 or later, and make every script a permissioned parent may spawn refuse to start without the model. `process.permission` is defined only when `--permission` is on (`initializePermission()` in `pre_execution.js` defines it inside `if (permission)`):

```js
// first lines of any script a permissioned parent may spawn
if (typeof process.permission?.has !== 'function') {
  throw new Error('started without the Permission Model');
}
```

**Symptom:** A spawned Node child is stricter or looser than the parent's policy, when the parent's grants live in `NODE_OPTIONS` or a config file
**Cause:** The copy loop only forwards `process.execArgv` entries that start with `--permission` or one of the seven `--allow-*` names. Read from the source, not run; see point 2 above. A config-file parent forwards `--permission` without the grants, so the child is denied what the parent may read. A parent started wholly through `NODE_OPTIONS` that spawns with a custom `env` lacking it forwards nothing, so the child starts with no model: the dangerous direction.
**Fix:** Do not rely on forwarding. Write the child's flags explicitly, as in the second gotcha above, so the child's policy is in its own argument list and is reviewable in one place, and put the boot assertion from the third gotcha in every spawned script.

**Symptom:** `process.execArgv` inside a `spawn()`ed child shows no permission flags, so the child looks unrestricted
**Cause:** `spawn()` forwards the flags through `NODE_OPTIONS`, which the docs contrast with passing them *"directly through the process arguments"*, and `process.execArgv` lists command-line options.
**Fix:** Ask the child's runtime, not its argument list:

```js
// inside the spawned child
process.permission?.has('fs.read', '/etc/passwd');   // false when the model is on and /etc/passwd is not granted
```

## Interview questions

**★ What does a spawned child inherit when the parent runs with `--permission --allow-child-process`?**
Since v24.4.0 a Node child inherits the parent's permission flags: `fork()` through the argument list (`process.execArgv` is
placed in front of the module path), `spawn()` through `NODE_OPTIONS`. A non-Node child is not itself constrained, because
the flags are enforced by the Node runtime that reads them; the `NODE_OPTIONS` variable reaches it but is not acted on.
And inheritance is skipped entirely when the child already carries its own `--permission`, in its arguments or in
`NODE_OPTIONS`.

**★ Why is that inheritance not a security boundary?**
Three independent reasons, all in `lib/child_process.js`. The guard (its comment reads "Do not override if permission was
already passed to file") lets a child state a wider policy of its own. The copy loop forwards only `process.execArgv` entries that start with
`--permission` or an `--allow-*` name, so grants that arrived another way are not forwarded. And a non-Node child is outside
the model. The docs say it plainly: the model is a "seat belt" for trusted code and gives no security guarantees against
malicious code, and the runtime prints a `SecurityWarning` that `--allow-child-process` could invalidate the model.

**★ How would you run helper processes under the Permission Model?**
Prefer in-process APIs, which the model does check. If a helper must be a separate process, make it a Node script and spawn
it with its own explicit, narrower `--permission --allow-*` flags and caller data after the script name, and have the script
assert `process.permission` at boot. Treat the whole arrangement as an accident guard, and put untrusted work behind a
container or OS sandbox, as [page 24](24-permission-model.md) argues.

**What did #63972 change in 24.19.0, and how would you have noticed the bug?**
The guard that decides "the child already has a permission policy" used a substring test on `NODE_OPTIONS`. An unrelated
value such as `--title=--permission` made it return early, so no flags were copied and the child ran without the model,
with no error. You would only notice by asking the child, for example `process.permission` being `undefined` inside it, or
by a boot assertion like the one in the gotchas. The 24.19.0 code splits `NODE_OPTIONS` into tokens and matches
`--permission` exactly instead.

**How do `fork()` and `spawn()` differ in how the flags reach the child?**
The docs: `fork()` *"inherits the execution arguments from the parent process"*, while for `spawn()` the flags are
*"propagated via the `NODE_OPTIONS` environment variable rather than directly through the process arguments"*. In the
source, `fork()` prepends `execArgv` to the arguments, so the guard sees `--permission` in `args` and returns; `spawn()`
passes through the copy loop, which appends matching `process.execArgv` entries to `NODE_OPTIONS`.

---

← Prev: [The Permission Model](./24-permission-model.md) · Next → [Web Crypto API](./25-web-crypto.md)
