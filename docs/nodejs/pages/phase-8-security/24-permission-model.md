---
title: "The Permission Model"
sidebar_label: "24 · Permission Model"
sidebar_position: 24
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — every output below is from
> `sandbox/p8-security/ex22-permission-model.mjs`.

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

Child processes and workers are separate, because each is a way out:

```console
spawn without --allow-child-process  -> exit 1  ERR_ACCESS_DENIED
spawn with --allow-child-process     -> exit 0  child ran
```

That is the important pairing. **`--allow-child-process` is total** — the child is a new
process with no permission model at all, so granting it discards everything else you
configured. Same for `--allow-addons`: native code is outside the model by construction,
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

There is no escalation API on Node 24 — which is the correct design, and also means the
command line is the only place the policy exists. It is not in your code, not in
`package.json`, and trivially lost when someone edits a Dockerfile or a `start` script.

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
| Where the policy lives | a CLI flag | image and orchestration config |

They compose well: the container is the security boundary, and the Permission Model is a
cheap second layer inside it that catches the file-write a dependency should never have
attempted.

## Gotchas

**Symptom:** `ERR_ACCESS_DENIED` appears in production after adding `--permission`
**Cause:** A library reads a config file, a temp directory or a CA bundle you did not grant.
**Fix:** Run the full test suite under the flags. Denials are exceptions, so they surface where the read happens, not at startup.

**Symptom:** The permission model appears to do nothing
**Cause:** A `try/catch` around the operation swallowed `ERR_ACCESS_DENIED`, or `--allow-child-process` was granted and the work moved to a child with no restrictions.
**Fix:** Test the denial path explicitly; treat `--allow-child-process` as opting out.

**Symptom:** A dependency still exfiltrated data under `--permission`
**Cause:** There is no network permission on Node 24 — verified, a TCP connect succeeded with only `--allow-fs-read` granted.
**Fix:** Egress control at the container or network layer. The Permission Model is not the place.

**Symptom:** `--allow-fs-read=/data` also permits `/data-backup`
**Cause:** Prefix matching, the same trap as page 10.
**Fix:** Include the trailing separator or an explicit `/*`, and verify with a negative test.

**Symptom:** The flags disappeared after a deployment change
**Cause:** The policy lives only on the command line — a changed `start` script or entrypoint drops it silently.
**Fix:** Put them in the `start` script *and* assert `process.permission?.has('fs.write') === false` at boot.

## Interview questions

**★ What does Node's Permission Model cover, and what is the significant gap?**
Filesystem reads and writes by path, child processes, worker threads, native addons, WASI
and the inspector. **The gap is the network** — there is no `--allow-net` on Node 24;
verified, `node --permission --allow-net` errors with `bad option`, and a process with only
`--allow-fs-read` still completed a TCP connection. So it cannot contain SSRF or
exfiltration.

**★ Is it a sandbox for untrusted code?**
No. It reduces blast radius for code you chose to install. Untrusted code needs a process
and OS boundary — a container with a read-only filesystem and egress rules. Granting
`--allow-child-process` alone discards the model, since the child runs unrestricted.

**★ How does a denial surface?**
As a thrown `ERR_ACCESS_DENIED`, not a return value. That means existing error handling
catches it, and a library with a broad `try/catch` can hide the fact that the sandbox is
doing anything. Test the denial path.

**★ Where does it fit alongside supply-chain controls?**
It is the runtime half of page 23. A blocked install script and an allowlisted dependency
reduce the chance of hostile code; `--allow-fs-read=./src --allow-fs-write=./dist` limits
what that code reaches if it arrives anyway.

**Can permissions be changed while the process runs?**
No — there is no runtime API on Node 24, verified. The policy exists only as command-line
flags, which is why it should be asserted at boot: a changed entrypoint silently removes
it.

---

← Prev: [Supply chain](./23-supply-chain.md) · Next → Web Crypto API *(being written)*
