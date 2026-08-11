---
title: "Single Executable Applications"
sidebar_label: "26 · Single executables"
sidebar_position: 26
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), Linux x64. SEA is
> **Stability 1.1 — Active development**; the workflow below is stable enough to
> use and the API may still move.

**A SEA is the Node binary with your application injected into it. One file, no
`node` on the target machine, no `node_modules`. It is a distribution format for
CLI tools — not a way to deploy a server, where a container already solves this.**

## Building one, end to end

```js
// app.js — CommonJS. ESM as the SEA entry point is not supported yet.
const { getAsset, isSea } = require('node:sea');

console.log('running inside a SEA?', isSea());
console.log('argv:', process.argv.slice(2));
console.log('bundled asset:', getAsset('greeting.txt', 'utf8').trim());
console.log('node version inside the binary:', process.version);
```

```json
// sea-config.json
{
  "main": "app.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "assets": { "greeting.txt": "greeting.txt" }
}
```

```bash
node --experimental-sea-config sea-config.json          # 1. build the blob
cp "$(command -v node)" myapp                            # 2. copy the runtime
npx postject myapp NODE_SEA_BLOB sea-prep.blob \         # 3. inject
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

```console
$ node --experimental-sea-config sea-config.json
Wrote single executable preparation blob to sea-prep.blob

$ npx postject myapp NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
💉 Injection done!

$ ./myapp --port 8080
running inside a SEA? true
argv: [ '--port', '8080' ]
bundled asset: hello from a bundled asset
node version inside the binary: v24.19.0
```

`postject` finds a sentinel string compiled into the Node binary and writes the
blob over it. On macOS the binary must be re-signed afterwards
(`codesign --sign -`), and on Windows `signtool` is used if the original was
signed — an unsigned or invalidly signed binary will not run.

The blob is **not** encrypted or obfuscated. Your source is in there in plain
text; `strings myapp` finds it. A SEA is a packaging format, not a protection
mechanism.

## What it costs

```console
$ ls -lh myapp
-rwxr-xr-x. 1 sairam sairam 121M Aug 10 17:03 myapp
```

**121 MB for a script that prints four lines** — the whole Node runtime, because
that is exactly what it is. Compression (UPX) and `--build-snapshot` can reduce
startup and size somewhat, but the order of magnitude does not change.

## The constraints that decide whether you can use it

| | |
|---|---|
| **Entry point must be CommonJS** | ESM is not supported as the SEA main. Bundle to CJS with esbuild first |
| **`require` only resolves built-ins** | There is no `node_modules` inside. **Everything must be bundled into one file** |
| **Assets are declared, not read from disk** | `sea.getAsset()` / `getAssetAsBlob()`; `fs` still reads the real filesystem |
| **`__dirname` is the binary's directory** | Not a virtual root. Path assumptions from a normal script break |
| **One binary per platform/arch** | Cross-compiling means copying the *target's* Node binary; build on the target, or in its container |

So the real workflow is **bundle, then inject**:

```bash
esbuild app.js --bundle --platform=node --format=cjs --outfile=dist/app.cjs
node --experimental-sea-config sea-config.json
```

Native addons (`.node` files) cannot be bundled at all. If a dependency has one,
SEA is out ([Phase 12](../../syllabus/04-production.md)).

## When it is the right answer

Good: an internal CLI you hand to people who do not have Node and should not have
to install it; a tool shipped to customers as one download; a build-step binary
pinned to an exact runtime so CI cannot drift.

Bad: **anything you deploy as a service.** A container image already gives you a
pinned runtime and a single artefact, with layer caching, a registry, scanning and
orchestration that a 121 MB binary does not.

Alternatives worth knowing, since SEA is the newest and least mature: **`pkg`** is
unmaintained but was the standard for years; **`nexe`** is similar; **Bun** and
**Deno** both compile to a single binary as a first-class, non-experimental
feature with cross-compilation built in. If single-binary distribution is a
primary requirement rather than a convenience, those are worth comparing before
committing to SEA.

## Gotchas

**Symptom:** `Cannot find module` for a dependency that is installed
**Cause:** `require` in a SEA resolves built-ins only.
**Fix:** Bundle everything into the entry file first.

**Symptom:** The build rejects an ESM entry point
**Cause:** Only CommonJS is supported as the SEA main.
**Fix:** Bundle to CJS.

**Symptom:** The binary will not run on macOS — "killed" or a signature error
**Cause:** Injection invalidated the code signature.
**Fix:** `codesign --sign - myapp` after injecting.

**Symptom:** Reading a data file works in development and fails in the binary
**Cause:** The file was never bundled; `__dirname` is the binary's directory.
**Fix:** Declare it in `assets` and read it with `sea.getAsset()`.

**Symptom:** The Linux binary does not run on the target machine
**Cause:** It embeds the Node build it was made from — wrong arch, or a different
libc (glibc versus musl).
**Fix:** Build on the target platform, or in its container image.

**Symptom:** Source code is readable in the shipped binary
**Cause:** The blob is not encrypted.
**Fix:** None at this layer. Do not ship secrets in a SEA.

## Interview questions

**★ What is a Single Executable Application?**
The Node binary with a preparation blob — your bundled CommonJS entry point plus
declared assets — injected into it by `postject`. The result runs on a machine
with no Node installed, at the cost of shipping the whole runtime: 121 MB for a
trivial script.

**★ What must you do before building one?**
Bundle. `require` inside a SEA resolves only built-in modules, so every dependency
must already be in the single CommonJS file. Native addons cannot be bundled at
all, which rules SEA out for anything depending on one.

**★ Would you ship a web service this way?**
No. A container image already provides a pinned runtime and a single deployable
artefact, plus layer caching, registries, scanning and orchestration. SEA is for
distributing CLI tools to machines without Node.

**★ Does a SEA protect your source code?**
No. The blob is stored unencrypted and unobfuscated — `strings` on the binary
recovers it. It is a packaging format, and secrets must not be baked in.

**How do you ship a data file with a SEA?**
Declare it under `assets` in the config and read it with `sea.getAsset()`. `fs`
still points at the real filesystem, so a relative path that worked in development
resolves against the binary's directory instead.

**How do you build for another platform?**
You copy that platform's Node binary and inject into it, so in practice you build
on the target OS and architecture, or inside its container image. There is no
cross-compilation the way Bun and Deno provide it.

---

← Prev: [Shared memory](25-shared-memory.md) · Phase index: [Networking, HTTP, processes](README.md)
