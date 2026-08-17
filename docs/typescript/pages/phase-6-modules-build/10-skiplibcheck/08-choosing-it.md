---
title: "Choosing it — the policy"
sidebar_label: "08 · Choosing it"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — the policy below follows from the compiler behaviour
> established in chunks 01–07, each of which names its own source in the
> installed **TypeScript 5.9.3** build; the `--showConfig`, `extends` and
> `tsBuildInfoFile` behaviour is the **TSConfig reference**'s. **No sandbox, no
> console blocks** — no timing claim is made here, because none was measured.

Seven chunks of mechanism, and now the decision. It is not "on or off" — that
framing is what produces the library-author trap. It is **which build, and what
you check instead**.

## The decision, in one place

```
what is this build FOR?

├─ the dev loop / an application you deploy
│    → skipLibCheck: true
│      Other people's declarations are the only ones in play and you
│      cannot fix them anyway.
│
├─ the job that emits .d.ts files you PUBLISH
│    → skipLibCheck: false          🔴 non-negotiable
│      The artefact is a declaration file. This flag excludes it from
│      verification. (chunk 02)
│
├─ you hand-write .d.ts files (shims, globals, ambient declarations)
│    → at least one build with skipLibCheck: false
│      Otherwise the file-format rules are not enforced at all. (chunk 03)
│
└─ a monorepo where packages consume each other's built dist/*.d.ts
     → the producing package's build has it false; the consumer may have
       it true. (chunk 02)
```

🔴 **The axis is not risk tolerance. It is whether the declaration files that
matter to this build are yours or someone else's.**

## Start by finding out what you have

Before changing anything — because [chunk 06](./06-who-turns-it-on-for-you.md)
established that four separate mechanisms set this flag without anyone typing it:

```bash
tsc --showConfig | grep -i skiplibcheck      # the resolved value, extends included
tsc --showConfig -p tsconfig.build.json | grep -i skiplibcheck
```

Then find out what it is hiding, which is a single command:

```bash
tsc --noEmit --skipLibCheck false
```

⚠️ **Expect a lot of output the first time, and most of it will not be
actionable.** That is not a reason to stop — it is the reason for the next
section.

## Triaging the flood

Turning the flag off in a mature project typically produces errors from three
populations, and only one of them is yours:

| Where the error points | What to do |
|---|---|
| A `.d.ts` **you wrote** | 🔴 Fix it. This is the whole point of the exercise |
| Your **built `dist/*.d.ts`** | 🔴 Fix it — it is the published artefact |
| `node_modules/**` | Triage: is it a duplicate-types problem you can fix, or a broken dependency you cannot? |

For the third row, the TSConfig reference is explicit that the common case — two
copies of a library's types — *"is a symptom of a problem in your repository
which is better solved by fixing your dependencies"*
([chunk 04](./04-what-it-does-not-do.md)). Deduplicate first. What remains after
that is genuinely somebody else's broken file, and that is the population
`skipLibCheck` exists for.

### The trick for checking only *your* declarations

There is no flag for it ([chunk 04](./04-what-it-does-not-do.md)), but there is a
configuration that gets close: **check the built package from a separate, minimal
project whose only input is your own output.**

```jsonc
// tsconfig.dts-check.json — no src, no deps beyond what dist needs
{
  "compilerOptions": {
    "skipLibCheck": false,
    "noEmit": true,
    "types": []          // don't pull in ambient @types you didn't declare
  },
  "include": ["dist/**/*.d.ts"]
}
```

That checks your declarations, keeps the `node_modules` surface as small as your
package genuinely requires, and doubles as a rough consumer simulation. It is not
a substitute for the real thing — **11 · Publishing a typed package** *(not
written yet)* covers `arethetypeswrong` and `publint`, which test resolution
under every consumer configuration rather than just checking the files.

## The two-config split, complete

Pulling together chunks 02 and 07 — the second config needs a separate
`tsBuildInfoFile` or the incremental cache thrashes:

```jsonc
// tsconfig.json — the dev loop
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsc/app.tsbuildinfo"
  }
}

// tsconfig.build.json — the published declarations
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "skipLibCheck": false,
    "declaration": true,
    "tsBuildInfoFile": "./node_modules/.cache/tsc/build.tsbuildinfo"
  }
}
```

📌 **Write `false` explicitly.** Deleting the line from the derived config
inherits `true` from the base — and even in a config with no base, absence means
the compiler default, which is `false`, not `true`
([chunk 06](./06-who-turns-it-on-for-you.md)). Explicit is the only spelling that
survives someone else reading it.

## What this does not decide

**Speed.** No timing is claimed here, because none was measured. The flag
plainly reduces work — the checker skips whole files — but declaration files are
still resolved, parsed and bound ([chunk 04](./04-what-it-does-not-do.md)), so
the saving is bounded, and how large it is depends entirely on your dependency
surface. **Phase 12 · Tooling, performance and testing** *(not written yet)* owns
that measurement.

If you need the answer for your own project, `tsc --noEmit --extendedDiagnostics`
with the flag on and off is the honest way to get it — a number from your repo,
not from an article about someone else's.

## A reviewable rule for a team

Something short enough to put in a contributing guide:

> `skipLibCheck: true` is fine in `tsconfig.json`. It must be `false` in any
> config that emits declaration files we publish, and CI must run at least one
> `--noEmit` pass with it `false` over `src/**/*.d.ts`. If you add it anywhere
> else, say in the PR which error it was for.

That last clause is the one that matters most in practice, because the flag's
real failure mode is not "someone chose wrong". It is
[chunk 04](./04-what-it-does-not-do.md)'s: it gets added speculatively while
chasing an unrelated error, it does not help, the real fix lands separately, and
the line stays forever.

## Gotchas

**Symptom:** Turning the flag off produced hundreds of errors and the change was
reverted.
**Cause:** All-or-nothing scope — the flood is mostly dependencies.
**Fix:** Scope it to the declaration-checking config, or use the
`dist/**/*.d.ts`-only project above.

**Symptom:** The published package still ships broken types despite a
`skipLibCheck: false` build.
**Cause:** That build checks the declarations; it does not test whether consumers
can *resolve* them.
**Fix:** Different failure, different tool — `arethetypeswrong`/`publint`,
topic 11.

**Symptom:** The team agreed on the split and it silently stopped working.
**Cause:** Someone added `skipLibCheck: true` to the base config, and the derived
config inherits it wherever it does not override.
**Fix:** Write `false` explicitly in the build config and assert it in CI:
`tsc --showConfig -p tsconfig.build.json | grep '"skipLibCheck": false'`.

**Symptom:** Two configs, both incremental, and neither build ever gets faster.
**Cause:** A shared `tsBuildInfoFile` — chunk 07.
**Fix:** One buildinfo path per option set.

**Symptom:** A PR adds `skipLibCheck` with no explanation and CI goes green.
**Cause:** It is a one-line change that makes errors disappear, so it looks like
a fix.
**Fix:** Ask which error. If the answer is an error in application code, the flag
did nothing and something else fixed it.

**Symptom:** A library sets it `false` everywhere and the dev loop is painful.
**Cause:** Over-correcting — the dev loop is checking every dependency's
declarations on every run.
**Fix:** The split exists precisely to avoid this. `true` for the loop, `false`
for the artefact.

**Symptom:** `skipLibCheck: false` in CI fails on a dependency you cannot fix.
**Cause:** The genuine case the flag is for.
**Fix:** Keep the flag on for the app build, and scope the strict check to your
own declarations with the `include`-limited project above.

**Symptom:** Somebody asks "how much time does it actually save us?"
**Cause:** Every article gives a different number, all from different repos.
**Fix:** Measure your own — `--extendedDiagnostics` both ways. Nobody else's
number is about your dependency surface.

## Interview questions

**★ Should a project set `skipLibCheck: true`?**
For an application or the dev loop, yes — the declaration files in play are all
dependencies you cannot fix. For a build that emits published `.d.ts` files, no:
that build's most important declaration file is your own output, and the flag
excludes it from checking.

**★ How do you get both?**
Two configs. `skipLibCheck: true` in `tsconfig.json`, `false` in
`tsconfig.build.json`, each with its own `tsBuildInfoFile` so the incremental
caches do not invalidate each other.

**★ Turning it off floods you with dependency errors. What now?**
Triage by path. Errors in your own `.d.ts` or your `dist` are the point of the
exercise. Duplicate-types errors are a dependency problem to deduplicate. What
remains is a genuinely broken dependency — the case the flag is for. Or check
only your own declarations from a project whose `include` is `dist/**/*.d.ts`.

**★ How much build time does it save?**
Depends entirely on your dependency surface, and it is smaller than people expect
because declaration files are still resolved, parsed and bound — only the check
is skipped. Measure it with `--extendedDiagnostics` on your own repo rather than
quoting a figure from elsewhere.

**Why write `"skipLibCheck": false` explicitly rather than omitting the line?**
Because a derived config inherits `true` from its base, and because the widely
believed "default is `true`" makes omission ambiguous to the next reader.
Explicit survives.

**What is the flag's most common real-world failure mode?**
Not a wrong decision — it is being added speculatively while chasing an unrelated
error, not helping, and never being removed. Which is why "say which error it was
for" is the useful review rule.

**Does a `skipLibCheck: false` build guarantee your published types work?**
No. It checks that the declarations are internally coherent. Whether a consumer
can resolve them under their `module`/`moduleResolution` is a separate question
that needs `arethetypeswrong` or `publint`.

---

← Prev: [07 · The `.tsbuildinfo` interaction](./07-the-tsbuildinfo-interaction.md) · Back to [the topic index](./README.md)
