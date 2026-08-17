---
title: "The `.tsbuildinfo` interaction"
sidebar_label: "07 · The .tsbuildinfo interaction"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the incremental builder's `copyDeclarationFileDiagnostics`
> and `copyLibFileDiagnostics` computation, the `affectsBuildInfo` flag on both
> option records, and the comment above them are read out of the installed
> **TypeScript 5.9.3** build. The `incremental`/`composite` behaviour is the
> **TSConfig reference**'s. **No sandbox, no console blocks.**

`skipLibCheck`'s option record carries exactly one behavioural flag —
`affectsBuildInfo` — and a source comment explaining why:

```js
// We need to store these to determine whether `lib` files need to be rechecked
affectsBuildInfo: true,
```

This chunk is what that comment means. It matters because it turns the
two-config advice from [chunk 02](./02-it-skips-your-declarations-too.md) into
something with a **cost you can predict**, rather than a rule you follow on
faith.

## What `affectsBuildInfo` buys

An incremental build (`incremental: true`, or `composite: true`, which implies
it) writes a `.tsbuildinfo` file recording what it checked and what the results
were. On the next run it reuses everything that cannot have changed.

`affectsBuildInfo` means the option's value is **written into that file**, so the
next build can tell whether you changed it. Without that, a build could reuse
results produced under different rules.

## 🔴 The exact rule

From the builder state setup:

```js
const copyDeclarationFileDiagnostics =
  canCopySemanticDiagnostics
  && !compilerOptions.skipLibCheck === !oldCompilerOptions.skipLibCheck;

const copyLibFileDiagnostics =
  copyDeclarationFileDiagnostics
  && !compilerOptions.skipDefaultLibCheck === !oldCompilerOptions.skipDefaultLibCheck;
```

Read it as two conditional permissions:

> **Cached diagnostics for declaration files may be reused only if
> `skipLibCheck` has the same truthiness as last time.** And cached diagnostics
> for default-lib files additionally require `skipDefaultLibCheck` unchanged.

Three things follow, and all three are practical.

### 1. Flipping the flag invalidates a specific slice of the cache

Not the whole build — the `.tsbuildinfo` is not discarded, and your `.ts` files'
cached diagnostics survive (that is `canCopySemanticDiagnostics`, a separate and
broader condition). What is thrown away is precisely the **declaration files'**
diagnostics, which is exactly the set whose validity the flag governs.

So the cost of the two-config split is bounded and predictable: the run where you
flip it re-checks declaration files, and subsequent runs with the same value are
incremental again.

### 2. 🔴 The comparison is `!a === !b` — truthiness, not identity

That double-negation is deliberate. `undefined` and `false` are both falsy, so:

- removing `"skipLibCheck": false` from a config **does not** invalidate
  anything — absent and explicit-`false` compare equal;
- switching `false` → `true` or `true` → `false` **does** invalidate;
- `true` → `true` written differently (via `extends` instead of directly) does
  **not**.

That is the correct semantics — what matters is the value the compiler used, not
how it was spelled — and it means you cannot accidentally invalidate the cache by
reorganising a config.

### 3. Two configs means two `.tsbuildinfo` files, or you thrash

⚠️ **This is the part that bites in CI.** If `tsconfig.json` (flag on) and
`tsconfig.build.json` (flag off) both write to the *same* `.tsbuildinfo` path,
every run alternates the flag and every run discards the other's declaration
diagnostics. The incremental cache does exactly the wrong thing: it is present,
it is consulted, and it never helps.

`tsBuildInfoFile` fixes it:

```jsonc
// tsconfig.json
{ "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsc/app.tsbuildinfo" } }

// tsconfig.build.json
{ "extends": "./tsconfig.json",
  "compilerOptions": {
    "skipLibCheck": false,
    "declaration": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsc/build.tsbuildinfo" } }
```

📌 **`extends` does not separate them automatically.** A derived config inherits
`tsBuildInfoFile` along with everything else, so the second file has to be named
explicitly. The default location is derived from `outDir`/`configFilePath`, which
is why two configs emitting to the same `outDir` collide by default.

**14 · Incremental builds** *(not written yet)* owns `.tsbuildinfo` in general —
what else invalidates it, what it contains, and how to cache it in CI. This chunk
owns only the `skipLibCheck` half of that story.

## The consequence for caching CI

If your CI caches `.tsbuildinfo` across runs, a job that flips `skipLibCheck` on
alternate runs gets a cache that is technically valid and practically useless.
The symptom is a build time that never improves despite the cache reporting a
hit.

The check is cheap: **one `.tsbuildinfo` path per distinct compiler-option set.**
That rule is not special to this flag — it is just that `skipLibCheck` is the
option people most often vary between two otherwise-identical configs, so it is
where the collision usually shows up.

## Gotchas

**Symptom:** Adding a `tsconfig.build.json` with `skipLibCheck: false` made both
builds slower, permanently.
**Cause:** Both write the same `.tsbuildinfo`, so each run invalidates the
other's declaration-file diagnostics.
**Fix:** Give each config its own `tsBuildInfoFile`.

**Symptom:** Flipping the flag triggered a re-check and it was blamed on a full
rebuild.
**Cause:** Only declaration-file diagnostics are invalidated, not the whole
cache.
**Fix:** Expected and bounded. The next run at the same value is incremental
again.

**Symptom:** Removing `"skipLibCheck": false` from a config caused no
invalidation, which seemed wrong.
**Cause:** The comparison is `!a === !b`. Absent and explicit-`false` are both
falsy, so nothing changed.
**Fix:** Correct behaviour — and a reminder that removing the line does not turn
checking off ([chunk 06](./06-who-turns-it-on-for-you.md)).

**Symptom:** CI reports a `.tsbuildinfo` cache hit and the build takes as long as
a cold one.
**Cause:** The cached state was produced under a different option set.
**Fix:** One buildinfo path per option set, and check whether anything in the
pipeline varies flags between runs.

**Symptom:** A `composite` project seems to ignore `incremental: false`.
**Cause:** `composite` implies `incremental`, so buildinfo is written regardless.
**Fix:** Expected. Project references always produce buildinfo.

**Symptom:** Deleting `.tsbuildinfo` "fixes" a stale-diagnostics problem, which
suggests the invalidation is unreliable.
**Cause:** Usually something *without* `affectsBuildInfo` changed — the
invalidation logic only covers options that declare it.
**Fix:** Deleting it is a legitimate reset. If it is needed often, find which
input is not being tracked.

**Symptom:** Two packages in a monorepo share an `outDir` and their buildinfo
files collide.
**Cause:** The default path is derived from `outDir`/`configFilePath`.
**Fix:** Distinct `outDir`s, or explicit `tsBuildInfoFile` per package.

**Symptom:** Someone proposes dropping the two-config split because "incremental
builds make it too expensive".
**Cause:** Reasonable-sounding, and wrong once the buildinfo paths are separate.
**Fix:** Separate paths make each config incremental on its own terms. The cost
is disk, not time.

## Interview questions

**★ `skipLibCheck` has `affectsBuildInfo`. What does that actually do?**
It writes the option's value into `.tsbuildinfo` so the next incremental build
can compare. Cached declaration-file diagnostics are reusable only when
`!skipLibCheck === !oldSkipLibCheck`; if the flag flipped, that slice of the
cache is discarded.

**★ Does flipping `skipLibCheck` invalidate the whole incremental build?**
No — only the declaration files' cached diagnostics. Your own files' results
survive under the broader `canCopySemanticDiagnostics` condition, so the cost is
one re-check of declaration files.

**★ You add a second config with the flag off. What must you also set?**
`tsBuildInfoFile`, to a different path. Otherwise both configs write the same
buildinfo and each run invalidates the other's declaration diagnostics — a cache
that hits and never helps.

**★ Why is the comparison written `!a === !b` rather than `a === b`?**
So it compares truthiness. `undefined` and `false` are the same effective value,
so removing an explicit `"skipLibCheck": false` does not invalidate anything, and
neither does respelling `true` through an `extends` chain.

**What about `skipDefaultLibCheck` in the same logic?**
`copyLibFileDiagnostics` requires *both* flags unchanged — it is derived from
`copyDeclarationFileDiagnostics` and adds its own comparison.

**Does `extends` give a derived config its own buildinfo path?**
No. `tsBuildInfoFile` is inherited like any other option, and the default path is
derived from `outDir`/`configFilePath`, so two configs sharing an `outDir`
collide.

**What is the CI symptom of getting this wrong?**
A `.tsbuildinfo` cache that reports hits while build times never improve, because
the cached state was produced under a different option set every time.

---

← Prev: [06 · Who turns it on for you](./06-who-turns-it-on-for-you.md) · Next → [08 · Choosing it](./08-choosing-it.md)
