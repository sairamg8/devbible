---
title: "Turbopack is the default bundler, so the interesting question is no longer whether to enable it but what stopped working when it became unavoidable"
sidebar_label: "01 · Turbopack in dev and production"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack)
> (docs build `version: 16.3.4`, `lastUpdated: 2026-08-03`). Documentation-verified;
> **no timings, no sandbox run** — `next` is not installed in this checkout, so no probe of it exists.
> Target: **Next.js 16.3.4 · Turbopack default since 16.0**.

**Turbopack stopped being a flag in Next.js 16.0 and became the thing that runs when you type `next dev`.** That
inverts the question every older write-up answers. You no longer opt in and measure a speedup; you inherit a
different bundler and discover, usually mid-migration, which of your build assumptions were webpack's rather than
Next.js's. The documentation is unusually direct about this — there is a published list of known behavioural gaps,
and it includes things that change rendered output, not just build ergonomics. This page covers what Turbopack is,
how the dev loop actually works, and the one escape hatch that still exists.

## What it is, in the docs' own words

> *"Turbopack is an **incremental bundler** optimized for JavaScript and TypeScript, written in Rust, and built into **Next.js**."*

The reference gives four design claims. They are worth reading as a set, because each one is a decision that
produces a specific behaviour you will later meet as a gotcha:

> *"**Unified Graph:** Next.js supports multiple output environments (e.g., client and server). Managing multiple compilers and stitching bundles together can be tedious. Turbopack uses a **single, unified graph** for all environments."*

> *"**Bundling vs Native ESM:** Some tools skip bundling in development and rely on the browser's native ESM. This works well for small apps but can slow down large apps due to excessive network requests. Turbopack **bundles** in dev, but in an optimized way to keep large apps fast."*

> *"**Incremental Computation:** Turbopack parallelizes work across cores and **caches** results down to the function level. Once a piece of work is done, Turbopack won't repeat it. Results persist to disk between runs."*

> *"**Lazy Bundling:** Turbopack only bundles what is actually requested by the dev server. This lazy approach can reduce initial compile times and memory usage."*

Two of those have consequences you can feel directly. **Lazy bundling** is why a cold `next dev` is fast but the
first visit to an un-visited route is not — the work was deferred, not eliminated. **Incremental computation with
function-level caching persisted to disk** is why the second `next dev` of the day starts warm, and why a corrupted
`.next` directory produces symptoms that look like source bugs.

🔴 **The single unified graph is the reason a `webpack()` config is not merely ignored but unsupported.** There is no
second compiler left to configure. That, and the rest of the configuration surface, is
[the next page](01b-configuring-the-turbopack-compile-pipeline.md).

## It is the default, and the version history says when

> *"Turbopack is now the **default bundler** in Next.js. No configuration is needed to use Turbopack"*

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

| Version | Change, verbatim |
|---|---|
| `v16.0.0` | *"Turbopack becomes the default bundler for Next.js. Automatic support for Babel when a configuration file is found."* |
| `v15.5.0` | *"Turbopack support for `build` beta"* |
| `v15.3.0` | *"Experimental support for `build`"* |
| `v15.0.0` | *"Turbopack for `dev` stable"* |

**Read that column downward and you get the migration story.** Dev was stable a full major before build was even
beta. A codebase that adopted `--turbo` for `next dev` in the 15.0 era and never revisited it has been running
*webpack builds and Turbopack dev* for two majors — which is precisely the configuration where a bug reproduces in
production and not locally, because the two artefacts were produced by different compilers.

### The escape hatch, and the platforms that force it

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack"
  }
}
```

> *"If you need to use Webpack instead of Turbopack, you can opt-in with the `--webpack` flag"*

This is not only a migration convenience. It is **mandatory** on some platforms:

> *"On platforms without native bindings (e.g. FreeBSD, OpenBSD), Next.js falls back to WebAssembly (WASM) bindings. WASM bindings support core SWC features like compilation and minification, but **do not support Turbopack**. On these platforms, use the `--webpack` flag"*

Native bindings exist for macOS (x64, ARM64), Windows (x64, ARM64), Linux glibc (x64, ARM64) and Linux musl (x64,
ARM64). **That list is the whole supported matrix.** A BSD build agent is not a supported Turbopack platform, and
the failure mode is a silent fallback rather than an error — you get WASM SWC and no Turbopack.

## The dev loop: Fast Refresh, and what it does not do

> *"**Fast Refresh** — Supported. Updates JavaScript, TypeScript, and CSS without a full refresh."*

> *"**Incremental Bundling** — Supported. Turbopack lazily builds only what's requested by the dev server, speeding up large apps."*

Fast Refresh needs no configuration and covers all three of JS, TS and CSS. What it explicitly does **not** cover is
your types:

> *"Uses SWC under the hood. Type-checking is not done by Turbopack (run `tsc --watch` or rely on your IDE for type checks)."*

🔴 **This is the single most consequential sentence on the reference page for day-to-day work.** SWC strips types; it
does not check them. A dev server that compiles cleanly proves nothing about `tsc`. If your only type feedback is
the dev overlay, type errors accumulate silently until CI or `next build` finds them all at once — and they arrive
in one lump, in files you stopped thinking about days ago.

```json
{
  "scripts": {
    "dev": "next dev",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "check": "npm run typecheck && next lint"
  }
}
```

Run `typecheck:watch` in a second terminal beside `next dev`, and make `check` the thing CI runs. The dev server is
not a type checker and never claimed to be.

### Root layout creation

> *"**Root layout creation** — Unsupported. Automatic creation of a root layout in App Router is not supported. Turbopack will instruct you to create it manually."*

A small thing, but it surprises people following older App Router tutorials where a missing `app/layout.tsx` was
scaffolded for you. Under Turbopack you get an instruction instead of a file.

## Where this goes next

The rest of Turbopack splits into three concerns, each with its own page:

| Page | Covers |
|---|---|
| [01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md) | The `turbopack` key, loaders vs plugins, and the Babel rule that reversed in 16 |
| [01c · Build-time constants and profiling](01c-import-meta-env-and-profiling-the-dev-server.md) | `import.meta.env`, dead-branch elimination, `--internal-trace` |
| **Migrating from webpack** *(not written yet)* | The behavioural gaps — CSS Module ordering, Lightning CSS precision, the filesystem root |

## Gotchas

**★ Symptom: the dev server is fast and clean, then CI fails with dozens of type errors at once.** Cause: Turbopack
compiles through SWC, which strips types without checking them — *"Type-checking is not done by Turbopack"*. Nothing
in the dev loop ever ran `tsc`. Fix: run the type checker as its own process, in dev and as a CI gate.

```json
{
  "scripts": {
    "dev": "next dev",
    "typecheck": "tsc --noEmit",
    "ci": "tsc --noEmit && next build"
  }
}
```

**★ Symptom: a build agent produces a working build, none of the Turbopack behaviour, and it is slow.** Cause: the
agent runs FreeBSD or another platform with no native bindings, so Next.js *"falls back to WebAssembly (WASM)
bindings"* which *"do not support Turbopack"*. It is a silent fallback, not a failure, so it reads as "Turbopack is
slow" rather than "Turbopack is absent". Fix: use a supported platform — macOS, Windows, or Linux glibc/musl on x64
or ARM64 — or make the fallback explicit in the script so nobody is misled:

```json
{
  "scripts": {
    "build:bsd": "next build --webpack"
  }
}
```

**★ Symptom: dev and production disagree, and only production is wrong.** Cause: a codebase that adopted Turbopack
for `next dev` during 15.x but never moved the build is running two different compilers — Turbopack in dev, webpack
in build. The version table is the tell: dev was stable in `v15.0.0`, build only became default in `v16.0.0`. Fix:
put both on the same bundler and say so explicitly while you migrate.

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}
```

**Symptom: a route is slow the first time it is opened in dev, every time the server restarts.** Cause: lazy
bundling — *"Turbopack only bundles what is actually requested by the dev server."* The cost was deferred to first
request, not removed. Fix: nothing to fix; this is the design. If it hurts a demo, visit the route once to warm it.
The FileSystem cache is what carries that work across restarts.

**Symptom: a missing `app/layout.tsx` is not scaffolded, and the error tells you to write one.** Cause: *"Automatic
creation of a root layout in App Router is not supported. Turbopack will instruct you to create it manually."* Fix:
create the file. The instruction is documented behaviour, not a bug.

**Symptom: deleting `.next` fixes a problem that looked like a source bug.** Cause: Turbopack *"caches results down
to the function level"* and *"Results persist to disk between runs"*, so a corrupted or stale cache produces
symptoms with no corresponding cause in your source. Fix: clear it, then treat a repeat occurrence as a bug worth
reporting rather than a routine step.

```bash
rm -rf .next
```

⚠️ **Do not make cache-clearing a habit or a build step.** It discards the persistent cache that makes warm starts
fast, and it hides the real problem — see the cache page for what is actually stored and when clearing is correct.

## Interview questions

**★ Turbopack became the default in 16.0. What breaks in a codebase that upgrades without changing config?**
Anything expressed through webpack's extension points. A `webpack()` function in `next.config.js` is not recognised
at all, and webpack *plugins* have no equivalent — loaders do, via `turbopack.rules`. Beyond config, two documented
behavioural gaps can change rendered output rather than just the build: CSS Module ordering now follows JS import
order, and Lightning CSS computes numeric CSS values at five decimal digits where webpack used ten. A codebase that
never touched `next.config.js` mostly upgrades cleanly; one with build tooling does not.

**★ Why is "Turbopack made our dev server fast" not the same claim as "Turbopack made our builds fast"?**
They stabilised two majors apart — dev was stable in 15.0, build support was experimental in 15.3, beta in 15.5, and
only became the default in 16.0. A team that adopted the dev flag early ran Turbopack in dev and webpack in build
for a long time, which is the configuration most likely to produce a bug that reproduces in production but not
locally. They are two separate claims with two separate histories, and conflating them is how "it works on my
machine" becomes structural.

**★ Your dev server compiles a file containing a type error without complaining. Why, and what should the setup be?**
Turbopack compiles through SWC, which strips TypeScript types rather than checking them; the docs say plainly that
*"Type-checking is not done by Turbopack"*. The dev overlay therefore reports syntax and runtime problems and never
type errors. The correct setup runs `tsc --noEmit` as a separate watch process in development and as a gate in CI,
so type feedback is continuous instead of arriving in one lump at build time.

**★ What does "lazy bundling" cost you, and when would you notice?**
It moves work from startup to first request. `next dev` becomes fast to boot on a large app, but the first visit to
each un-visited route pays its own compile. You notice it as a slow first navigation rather than a slow startup, and
it is most visible right after a restart on a route you had not opened yet. This is exactly why the persistent
FileSystem cache matters — it is what stops the second session of the day repeating the first session's work.

**Your CI runs on a BSD agent and Turbopack does not seem to be running. Is the build wrong?**
The build is valid but is not using Turbopack. Those platforms have no native bindings, so Next.js falls back to
WASM bindings that support core SWC compilation and minification but explicitly *"do not support Turbopack"*. It is
a silent degradation rather than an error, which makes it easy to misread as poor Turbopack performance. Either move
to a supported platform, or pass `--webpack` so the choice is visible in the script rather than inferred from a
platform check.

**Turbopack bundles in development. Why is that presented as an advantage when other tools stopped?**
Because the alternative trades one cost for another. Tools that skip bundling in dev and serve native ESM avoid
bundle work, but the browser then issues a request per module — fine for a small app, *"excessive network requests"*
on a large one. Turbopack's position is to keep bundling but make it incremental and lazy, so you get one artefact
per request without recomputing anything already computed. The claim is specifically about large applications; for a
small app the difference is not the point.

**What is the practical difference between Turbopack's disk cache and simply having a warm OS page cache?**
The docs describe caching *"down to the function level"* with results that *"persist to disk between runs"* — this
is memoised compiler work keyed by input, not merely fast file reads. That is why a second `next dev` starts warm
rather than merely reading source faster, and it is also why a stale or corrupted `.next` can produce behaviour with
no cause in your source: you are reusing computed results, not re-deriving them.

---

← [Chapter index](01-explanation.md) · Next → [01b · Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md)
