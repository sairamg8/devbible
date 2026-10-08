---
title: "The Permission Model"
sidebar_label: "24 · Permission Model"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-10-08 on **Node 24.19.0** against the Node.js docs for v24 — [Permission Model](https://nodejs.org/docs/latest-v24.x/api/permissions.html)
> (its "Configuration file support" section, read from the [v24.19.0 source](https://github.com/nodejs/node/blob/v24.19.0/doc/api/permissions.md)),
> [`--experimental-config-file`](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md) (v24.19.0 source),
> the `process.permission.drop()` entry in [`process.md`](https://github.com/nodejs/node/blob/v24.20.0/doc/api/process.md) (v24.20.0 source), and
> [CHANGELOG_V24.md](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md) (24.16.0, 24.20.0). Child-process inheritance is verified on [24b](24b-child-process-inheritance.md).
> The console blocks are from the 2026-08 run of `sandbox/p8-security/ex22-permission-model.mjs`; the `json`, `bash` and `js` fences added on 2026-10-08 were **not run**.

Node's Permission Model restricts what the **runtime** may do, from the command line,
without changing a line of code. It is the first in-process sandbox Node has shipped, and
the most useful thing to know about it is precisely where it stops.

## Turning it on

`--permission` denies everything, then you grant back:

```console
no flags                        -> {"has":"undefined"}
--permission                    -> {"fsRead":false,"fsWrite":false,"child":false,"worker":false,…}
--permission --allow-fs-read=…  -> {"fsRead":true, …}
```

The complete flag set on Node 24:

```console
--allow-fs-read=…      --allow-child-process    --allow-addons
--allow-fs-write=…     --allow-worker           --allow-wasi
                                                --allow-inspector
```

Denied operations throw rather than returning an error value:

```console
--permission, no allow                exit 1  ERR_ACCESS_DENIED
allow that exact file                 exit 0  read -> secret contents
same allow, reads /etc/passwd         exit 1  ERR_ACCESS_DENIED
```

`ERR_ACCESS_DENIED` is a normal exception, so it lands in your existing error handling —
and in a `try/catch` that swallows it. Test the denial path, or the sandbox becomes a
silent no-op inside a library that catches everything.

Paths are prefixes, and both forms work:

```console
--allow-fs-read=<dir>/*    -> allowed
--allow-fs-read=<dir>      -> allowed
```

Grant the narrowest path that works, and remember the prefix rule from
[page 10](./10-path-traversal.md) — `/data` as a prefix also matches `/data-backup`.

**Grants can also be declared in a configuration file**, behind an experimental flag. The permissions doc has a "Configuration file support" section, and CHANGELOG_V24.md lists *"src: add permission support to config file"* ([#60746](https://github.com/nodejs/node/pull/60746)) under 24.16.0:

> *"In addition to passing permission flags on the command line, they can also be declared in a Node.js configuration file when using the experimental `--experimental-config-file` flag. Permission options must be placed inside the `permission` top-level object."*

```json
{
  "permission": {
    "allow-fs-read": ["./foo"],
    "allow-fs-write": ["./bar"],
    "allow-child-process": true,
    "allow-worker": true,
    "allow-addons": false
  }
}
```

The documented way to run that `node.config.json` keeps `--permission` itself, and the flag
that loads the file, on the command line:

```bash
node --permission --experimental-default-config-file app.js
```

(Source: [Permission Model](https://github.com/nodejs/node/blob/v24.19.0/doc/api/permissions.md), v24.19.0 text.) The [CLI docs](https://github.com/nodejs/node/blob/v24.19.0/doc/api/cli.md) mark `--experimental-config-file` as `Stability: 1.0 - Early development`, and say *"If the path is not specified, Node.js will look for a `node.config.json` file in the current working directory."* So pin the path with the `=path` form, `--experimental-config-file=/app/node.config.json`, instead of depending on where the process happens to start.

Child processes and workers are separate, because each is a way out:

```console
spawn without --allow-child-process  -> exit 1  ERR_ACCESS_DENIED
spawn with --allow-child-process     -> exit 0  child ran
```

That is the important pairing, and it is subtler than "on or off". **A spawned Node child
is started with the parent's permission flags unless it states a policy of its own; a spawned
non-Node child is not itself constrained by them.** The CLI docs record the inheritance in the
flag's own history entry since v24.4.0, and Node prints a `SecurityWarning` when the flag is
set (*"must be used with extreme caution"*). The docs' wording, the source of the copy and the
ways it silently does not happen are on [24b](24b-child-process-inheritance.md). The short
version: for your own Node scripts it guards against accidents, and it is a hole for anything
hostile, because a non-Node binary, or a Node child with its own `--permission --allow-*`
flags, is outside the parent's flags.

`--allow-addons` is the same kind of door: native code is outside the model by construction,
and `process.dlopen` is refused without it (`ERR_DLOPEN_DISABLED`).

## What it does not do

**There is no network permission.** This is the fact to carry away:

```console
$ node --permission --allow-net -e "…"
node: bad option: --allow-net

$ node --permission --allow-fs-read=<dir>/* fetch.mjs
outbound -> TCP CONNECT SUCCEEDED
dns      -> 172.66.147.243
```

Fully locked down except for reading one directory, the process still resolved DNS and
opened a TCP connection to the public internet. **The Permission Model cannot contain
SSRF** ([page 12](./12-ssrf.md)), cannot stop a compromised dependency from exfiltrating
whatever it can read, and cannot prevent a request to a cloud metadata endpoint. Granular
network permissions have been discussed for later releases; on Node 24 they do not exist.

`process.permission.has('net')` returns `false`, and that is not evidence of the contrary
— `has()` returns `false` for **any** unrecognised scope, including `has('bogus.scope')`.
Do not read it as "network is denied".

**The environment is fully readable:**

```console
env vars readable -> 72
process.env.HOME  -> "/home/sairam"
```

Every secret in `process.env` ([page 18](./18-secrets.md)) is available to any code in the
process, permission model or not. So is `process.argv`.

**And permissions cannot be re-granted at runtime:**

```console
has deny() -> undefined
read /etc/hostname -> ERR_ACCESS_DENIED
```

There is no escalation API on Node 24 — which is the correct design. The grant also lives
outside your code: in command-line flags, in `NODE_OPTIONS` (the permissions doc's
`npx --node-options="--permission"` example), or in the experimental config file above. It is
not in `package.json`, and trivially lost when someone edits a Dockerfile or a `start` script.
A config file does not change that: in the documented example `--permission` and the flag
that loads the file are still on the command line.

Narrowing at runtime is a separate matter, and it is version-dependent. `process.permission`
has `has()` on 24.19.0 and nothing else; `process.permission.drop()` was added in
**24.20.0** (SEMVER-MINOR, [#62672](https://github.com/nodejs/node/pull/62672), listed under
24.20.0's Notable Changes in CHANGELOG_V24.md) and is not in the v24.19.0 permissions doc.
From 24.20.0 `process.md` marks it `Stability: 1.1 - Active Development`, and the permissions
doc describes it as:

> *"API call to drop permissions at runtime. This operation is **irreversible**."*

> *"Dropping a permission only affects future access checks. It does not close or revoke access to resources that are already open, such as file descriptors, child processes, or worker threads."*

> *"You can only drop the exact resource that was explicitly granted. The reference passed to `drop()` must match the original grant."*

```js
// Node >= 24.20.0 only. On 24.19.0 process.permission.drop is not defined.
import fs from 'node:fs';

const config = fs.readFileSync('/etc/myapp/config.json', 'utf8'); // while still allowed
process.permission.drop('fs.read', '/etc/myapp');                 // must match the grant exactly
process.permission.drop('child');                                  // whole scope: no reference
```

(Source: [Permission Model, Runtime API](https://nodejs.org/docs/latest-v24.x/api/permissions.html), v24.20.0 text.)
So `drop()` can only shrink the policy, never restore it, and a handle opened before the
drop stays usable. Do not call it unguarded in code that can run on 24.19.0, where
`process.permission` holds `has()` only; feature-check first:
`typeof process.permission?.drop === 'function'`.

## Where it is genuinely useful

The honest framing is **blast-radius reduction against your own dependencies**, not a
sandbox for untrusted code.

- **A build or CLI tool** that should only touch one directory. `--allow-fs-read=./src
  --allow-fs-write=./dist` turns "a postinstall script wrote to `~/.ssh`" into
  `ERR_ACCESS_DENIED` — a real complement to [page 23](./23-supply-chain.md).
- **A worker doing one job** — image resizing, PDF rendering — that has no business
  spawning processes or writing outside a temp directory.
- **Documenting intent.** A service that runs under `--permission --allow-fs-read=/app`
  states, enforceably, that it does not write to disk.

Where it does **not** belong: as the boundary for genuinely untrusted code. That needs a
process boundary and an OS sandbox — a container with a read-only filesystem, seccomp,
and network policy. The `vm` module is not that boundary either
([phase 12](../phase-12-native/)); a `vm.createContext({})` breakout returning
`process.version` is measured there.

## How it compares

| Concern | Permission Model | Container / OS |
|---|---|---|
| Filesystem read/write | ✅ path granular | ✅ mounts, read-only rootfs |
| Child processes | ✅ on/off | ✅ |
| Network | ❌ **not covered** | ✅ network policy, egress rules |
| Environment variables | ❌ fully readable | ✅ you choose what to inject |
| Native code | ✅ on/off (`--allow-addons`) | ✅ |
| Where the policy lives | CLI flags, `NODE_OPTIONS`, or an experimental config file | image and orchestration config |

They compose well: the container is the security boundary, and the Permission Model is a
cheap second layer inside it that catches the file-write a dependency should never have
attempted.

## Gotchas

**Symptom:** `ERR_ACCESS_DENIED` appears in production after adding `--permission`
**Cause:** A library reads a config file, a temp directory or a CA bundle you did not grant.
**Fix:** Run the full test suite under the flags. Denials are exceptions, so they surface where the read happens, not at startup.

**Symptom:** The permission model appears to do nothing
**Cause:** A `try/catch` around the operation swallowed `ERR_ACCESS_DENIED`, or `--allow-child-process` was granted and the work moved to a child the parent's flags do not constrain: a non-Node binary (`sh`, `curl`, `python`), or a Node child that states its own `--permission` ([24b](24b-child-process-inheritance.md)). A Node child that states no policy inherits the parent's flags since v24.4.0.
**Fix:** Test the denial path explicitly; treat `--allow-child-process` as opening a hole for every non-Node binary the process can reach and for any Node child the code can start with its own flags, and do not grant it unless you must. The in-process replacements for shell-outs are on 24b.

**Symptom:** A dependency still exfiltrated data under `--permission`
**Cause:** There is no network permission on Node 24 — verified, a TCP connect succeeded with only `--allow-fs-read` granted.
**Fix:** Egress control at the container or network layer. The Permission Model is not the place.

**Symptom:** `--allow-fs-read=/data` also permits `/data-backup`
**Cause:** Prefix matching, the same trap as page 10.
**Fix:** Include the trailing separator or an explicit `/*`, and verify with a negative test.

**Symptom:** The flags disappeared after a deployment change
**Cause:** The policy is not in your code. It comes from command-line flags, `NODE_OPTIONS` or an experimental config file, and `--permission` (plus the flag that loads a config file) is itself a command-line flag, so a changed `start` script or entrypoint can drop it silently.
**Fix:** Put the flags in the `start` script *and* assert at boot, for a service meant to write nothing:

```js
// first lines of the entry point
if (process.permission?.has('fs.write') !== false) {
  throw new Error('started without --permission, or with write access granted');
}
```

## Interview questions

**★ What does Node's Permission Model cover, and what is the significant gap?**
Filesystem reads and writes by path, child processes, worker threads, native addons, WASI
and the inspector. **The gap is the network** — there is no `--allow-net` on Node 24;
verified, `node --permission --allow-net` errors with `bad option`, and a process with only
`--allow-fs-read` still completed a TCP connection. So it cannot contain SSRF or
exfiltration.

**★ Is it a sandbox for untrusted code?**
No. It reduces blast radius for code you chose to install. Untrusted code needs a process
and OS boundary — a container with a read-only filesystem and egress rules. The docs'
own scope is that the model *"does not provide security guarantees in the presence of
malicious code"*. Granting `--allow-child-process` shows why: since v24.4.0 a spawned Node
child that states no policy inherits the permission flags (via `NODE_OPTIONS`, or the
execution arguments for `fork()`), which guards against accidents. But a child that carries
its own `--permission` is not given the parent's flags, and a non-Node child such as `sh` or
`curl` runs unrestricted ([24b](24b-child-process-inheritance.md)).

**★ How does a denial surface?**
As a thrown `ERR_ACCESS_DENIED`, not a return value. That means existing error handling
catches it, and a library with a broad `try/catch` can hide the fact that the sandbox is
doing anything. Test the denial path.

**★ Where does it fit alongside supply-chain controls?**
It is the runtime half of page 23. A blocked install script and an allowlisted dependency
reduce the chance of hostile code; `--allow-fs-read=./src --allow-fs-write=./dist` limits
what that code reaches if it arrives anyway.

**Can permissions be changed while the process runs?**
It can never be widened, and only narrowed on newer 24.x. There is no API to re-grant a
permission. `process.permission.drop()` was added in **24.20.0** (#62672): irreversible,
future checks only, and the reference must match the original grant. On this page's pin,
24.19.0, it does not exist, so the policy is whatever the startup configuration said. Either
way the grant comes from outside the code: command-line flags, `NODE_OPTIONS`, or the
experimental config file, with `--permission` itself still a flag. That is why it should be
asserted at boot: a changed entrypoint silently removes it.

**Can the grants live in a file instead of flags?**
Yes, since 24.16.0 and experimentally. The `permission` top-level object of a Node
configuration file takes `allow-fs-read`, `allow-fs-write`, `allow-child-process`,
`allow-worker` and `allow-addons` (the keys in the docs' example), and the file is loaded with
`--experimental-config-file`. Without `=path`, and through its alias
`--experimental-default-config-file`, Node looks for `node.config.json` in the current working
directory. The documented example still passes `--permission` on the command line. The flag is
`Stability: 1.0 - Early development`, so pin the path with
`--experimental-config-file=/app/node.config.json` and assert the policy at boot.

---

← Prev: [Supply chain](./23-supply-chain.md) · Next → [Child-process inheritance](./24b-child-process-inheritance.md)
