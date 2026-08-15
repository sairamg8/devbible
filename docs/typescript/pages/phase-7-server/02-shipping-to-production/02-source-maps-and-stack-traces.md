---
title: "Source maps and stack traces"
sidebar_label: "02 · Source maps and stack traces"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **Node.js API docs** — *Command-line API*
> (`--enable-source-maps`: added v12.12.0, no longer experimental v15.11.0 /
> v14.18.0; the `Error.prepareStackTrace` interaction and the `Error.stack`
> latency note are quoted from it) and *Modules* (the Source-map-v3 section:
> `module.findSourceMap`, the `SourceMap` class, `setSourceMapsSupport`,
> `NODE_V8_COVERAGE`, and the `node_modules` default) — plus the **`tsconfig`
> reference** on typescriptlang.org for `sourceMap`, `inlineSourceMap`,
> `inlineSources`, `sourceRoot`, `mapRoot` and `declarationMap`.
> **No sandbox, no console block** — in particular, **no stack trace is
> reproduced on this page**, because none was produced by a run. The shapes are
> described rather than pasted.

[Chunk 01](./01-what-actually-ships.md) established what is in the artefact. This
chunk is about the moment that artefact throws, at 3 a.m., and someone has to
read the result.

The problem exists only on Path A, and it exists inevitably:

> **A stack trace names the file that was executing.** On Path A the file that
> was executing is `dist/server.js`, whose line numbers correspond to nothing a
> human has ever read. The type annotations are gone, `async`/`await` may have
> been rewritten, and the numbering has drifted.

Node's documentation states the problem in exactly those terms: *"When using a
transpiler such as TypeScript, stack traces thrown by an application reference
the transpiled code, not the original source position."*

## Path B gets this for free — and it is worth understanding why

Node's type stripper **replaces type annotations with whitespace** rather than
deleting them. The character positions of everything that remains are unchanged,
so line and column numbers in the stripped output are identical to those in the
`.ts` file.

That is why Node's docs state it does **not generate source maps for
type-stripped code**: there is nothing to map. A trace from `src/server.ts:42`
points at line 42 of `src/server.ts`.

📌 This is the strongest practical argument for Path B, and it is rarely the one
people give. Not "no build step" — **no translation layer between the crash and
the code.**

⚠️ The exception is `--experimental-transform-types` (removed in v26.0.0), which
*did* transform rather than strip, and therefore *did* need maps. If you find a
codebase relying on it, that is a migration, not a flag flip.

## The TypeScript half — four options, two decisions

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSources": false
  }
}
```

| Option | What it does | Default |
|---|---|---|
| `sourceMap` | Emits a separate `.js.map` beside each `.js`, and appends a `//# sourceMappingURL=` comment pointing at it | `false` |
| `inlineSourceMap` | Embeds the map in the `.js` as a base64 `sourceMappingURL` data URI. **Mutually exclusive with `sourceMap`** | `false` |
| `inlineSources` | Embeds the original `.ts` **text** in the map's `sourcesContent`. Requires one of the two above | `false` |
| `declarationMap` | Maps `.d.ts` back to `.ts`, so a consumer's *Go to Definition* lands in your source. Library concern | `false` |

**Decision one: separate or inline?** For a server, separate (`sourceMap`). The
inline form exists for the browser case the docs describe — *"debug JS files on
a webserver that doesn't allow `.map` files to be served"* — which is not a
problem a Node process has, and it inflates every `.js` file with base64.

**Decision two: embed the sources, or not?** `inlineSources` makes the map
self-contained, so a stack trace can show the offending *line of TypeScript* and
not merely its coordinates. It also means **your entire source is inside the
artefact**, which is a deliberate trade and not a default.

Two options you will see and almost never want on a server: `sourceRoot` and
`mapRoot`, which rewrite the paths recorded *in* the map. They are for the case
where the maps or sources are served from a different URL than the JavaScript —
again, a browser problem. `mapRoot` in particular is treated verbatim, so a wrong
value produces maps that resolve to nothing, silently.

## The Node half — the flag, and its three caveats

Maps on disk do nothing by themselves. Node must be told to use them:

```bash
node --enable-source-maps dist/server.js
```

The flag was added in v12.12.0 and stopped being experimental in v15.11.0 /
v14.18.0. Node's docs describe what it does carefully — it *"enables caching of
Source Maps and makes a best effort to report stack traces relative to the
original source file"*. **"Best effort"** is the operative phrase: a mapping that
does not exist, or generated code with no corresponding original, is reported as
it stands.

### 🔴 Caveat 1 — it costs latency on `Error.stack`

Quoting the documentation:

> Note, enabling source maps can introduce latency to your application when
> `Error.stack` is accessed. If you access `Error.stack` frequently in your
> application, take into account the performance implications of
> `--enable-source-maps`.

This is a real production consideration, not a footnote, because the pattern that
triggers it is **extremely common**: a logging or error-reporting layer that
serialises `err.stack` on every caught error, including expected ones. A service
that treats 404s and validation failures as thrown errors and logs each one's
stack is doing source-map resolution on its normal path.

📌 The mitigation is not to disable the flag — it is to stop serialising stacks
for errors you expect. That is a design point **topic 04 · `catch (e: unknown)`**
*(dropped 2026-08-15)* returns to.

### 🔴 Caveat 2 — overriding `Error.prepareStackTrace` disables it

If anything in your process assigns `Error.prepareStackTrace` — and several
popular error-reporting and long-stack-trace libraries do — it can silently
prevent `--enable-source-maps` from rewriting anything. The docs give the
compatible pattern verbatim:

```js
const originalPrepareStackTrace = Error.prepareStackTrace;
Error.prepareStackTrace = (error, trace) => {
  // Modify error and trace and format stack trace with
  // original Error.prepareStackTrace.
  return originalPrepareStackTrace(error, trace);
};
```

**Capture the previous value and delegate to it.** A library that assigns without
delegating wins, and the failure is invisible: no warning, just traces that
quietly stop mentioning your `.ts` files.

### 🔴 Caveat 3 — `node_modules` is excluded by default

Source maps inside `node_modules` are **not** processed. That is the right
default — resolving maps for every dependency is cost you did not ask for — but
it means a trace that descends into a library stays in that library's compiled
output.

To include them, programmatically:

```js
import { setSourceMapsSupport } from 'node:module';

setSourceMapsSupport(true, { nodeModule: true });
```

This is a debugging measure, not a production setting.

## The other two ways maps get enabled

Worth knowing, because both produce the "why is this suddenly slower" question:

- **`NODE_V8_COVERAGE=dir`** enables source-map parsing as a side effect, since
  coverage output is meaningless against compiled files.
- **`module.setSourceMapsSupport(enabled[, options])`**, with
  `module.getSourceMapsSupport()` returning `{ enabled }` (added v23.7.0 /
  v22.14.0). This is how a process turns maps on for itself without a CLI flag —
  useful when the entry point is not under your control.

## Reading maps yourself

For anything that reports errors rather than printing them — a crash reporter, a
structured logger that wants `file`/`line` fields — Node exposes the map data
directly:

```js
import { findSourceMap } from 'node:module';

const map = findSourceMap('/app/dist/server.js');   // SourceMap | undefined
const origin = map?.findOrigin(lineNumber, columnNumber);
```

`SourceMap` also offers `payload` (the raw map object) and
`findEntry(lineOffset, columnOffset)`, which returns the mapping entry —
`generatedLine`, `generatedColumn`, `source`, `originalLine`, `originalColumn`,
`name`. The section is marked **Experimental** in the docs, which is worth
respecting for anything load-bearing.

## Do you ship the `.js.map` files?

The honest answer for a **service**: yes, and the objection people raise is a
browser objection.

- A `.js.map` in a container is not "exposed" — nothing serves it. The source is
  already in the image on Path B anyway, and the compiled `.js` on Path A is not
  meaningfully obfuscated.
- Without them, `--enable-source-maps` has nothing to work with and every
  production trace points at `dist/`.
- `inlineSources` is the genuinely debatable one, because it puts the full
  original text in the artefact. Decide it deliberately.

For a **published library** the calculus differs: `.js.map` files inflate the
package, and consumers rarely benefit. `declarationMap` (plus shipping the
`.ts` sources it points at) is the one that actually helps them, and it helps at
*edit* time rather than at crash time.

The third option is what error-monitoring vendors do — **upload the maps at
build time and delete them from the artefact**, so resolution happens in the
reporting service. That gets you readable traces in the dashboard and none on
the box, which is often exactly right, and is the only variant where "do not ship
the maps" is genuinely good advice rather than cargo cult.

## Gotchas

**Symptom:** `--enable-source-maps` is set, maps exist, and traces still name
`dist/`.
**Cause:** something in the process assigned `Error.prepareStackTrace` without
delegating to the previous value — commonly an error-reporting or long-stack-trace
library.
**Fix:** capture and delegate, per Node's documented pattern. Bisect by loading
the suspect library last and checking whether traces change.

**Symptom:** p99 latency rose after enabling source maps, on a service with no
errors.
**Cause:** it has errors — it just handles them. Something is reading
`err.stack` on a hot path, and each read now pays map resolution.
**Fix:** stop serialising stacks for expected errors. The flag is not the bug;
treating control flow as exceptional is.

**Symptom:** traces are readable for your code and useless the moment they enter
a dependency.
**Cause:** `node_modules` source maps are excluded by default.
**Fix:** `setSourceMapsSupport(true, { nodeModule: true })` while debugging.
Leave it off in production.

**Symptom:** the map file exists but resolves to nothing.
**Cause:** `sourceRoot` or `mapRoot` set to a value that made sense for a browser
deployment. `mapRoot` is recorded verbatim, so a wrong value fails silently.
**Fix:** delete both unless you are serving maps from a different origin, which a
Node service is not.

**Symptom:** on the type-stripping path, someone adds `sourceMap: true` "to be
safe" and nothing changes.
**Cause:** `noEmit` is on — there is no emit to map. Node preserves line numbers
by padding with whitespace and generates no maps.
**Fix:** remove it. Its presence implies a build step that does not exist.

## Interview questions

**Why does the type-stripping path not need source maps?**
Because Node replaces type annotations with whitespace instead of deleting them,
so every remaining token keeps its original line and column. The stripped output
is positionally identical to the source, which is why the docs state Node
generates no source maps for it. There is nothing to map.

**What are the two costs of `--enable-source-maps`?**
Latency whenever `Error.stack` is accessed — Node's docs call this out explicitly
— and a silent incompatibility with any code that overrides
`Error.prepareStackTrace` without delegating to the previous implementation. The
first is measurable; the second is invisible, which makes it worse.

**`sourceMap` versus `inlineSourceMap` versus `inlineSources` — pick for a
server and justify it.**
`sourceMap`: a separate `.js.map`, because nothing is serving these files and
inlining base64 into every `.js` buys nothing. `inlineSourceMap` solves a browser
problem — a host that will not serve `.map` files. `inlineSources` embeds the
original TypeScript text in the map, which makes traces show real source lines
and puts your whole source in the artefact; a real trade, not a default.

**A trace names your compiled output for your own frames but the correct source
for a dependency's. What happened?**
That ordering is backwards from the default and is the tell that something is
configured unusually — `node_modules` maps are *off* by default while your own
are on. Most likely `setSourceMapsSupport` was called with `nodeModule: true`
while your own build stopped emitting maps, or the app's maps were stripped from
the artefact while the dependency ships its own.

---

← [01 · What actually ships](./01-what-actually-ships.md) · Next → [Phase 7 index](../README.md)
