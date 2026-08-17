---
title: "The upstream fix"
sidebar_label: "06 · The upstream fix"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Declaration Files →
> Find and Install Declaration Files* (the contribution note is quoted verbatim)
> and *Publish to npm*. **No sandbox, no console blocks.** ⚠️ DefinitelyTyped's
> submission process and its tooling change independently of TypeScript releases;
> the shape below is stable, but check its contribution guidelines for the
> current steps rather than trusting a snapshot.

Every fix in this topic so far leaves you owning something: a shim to maintain, a
`paths` override to keep current, an assertion to re-justify at review. This
chunk is the one that does not — and the handbook puts it right at the end of the
consumption page for the same reason:

> if the declaration file you are searching for is not present, you can always
> contribute one back and help out the next developer looking for it.

## Two upstreams, and they are different

| | **DefinitelyTyped** (`@types/foo`) | **The package itself** |
|---|---|---|
| When | The library is JavaScript and its maintainers do not want to ship types | The library is TypeScript, or is willing to |
| You send | A PR to the DefinitelyTyped repository | A PR to the library |
| Lands in | `@types/foo`, versioned separately | The library's own release |
| Ongoing cost | The types drift from the library on every release | None — they are generated from the source |
| Best outcome | Fine | **Strictly better** — `declaration: true` makes drift structurally impossible |

🔴 **Prefer the package itself when it is a realistic option.** A separately
versioned `@types` package is a permanent source of the skew that
[chunk 05](./05-when-the-shipped-types-are-wrong.md) opens with. A library that
generates its own declarations from its own source
([topic 07 · chunk 04](../07-authoring-d-ts-files/04-generated-or-handwritten.md))
cannot drift, because the types *are* a projection of the code.

📌 **For a JavaScript library, "ship your own types" does not mean "rewrite in
TypeScript".** `allowJs` plus JSDoc annotations plus
`declaration: true` produces real declarations from plain JavaScript — the
option's own description is *"Generate `.d.ts` files from TypeScript **and
JavaScript** files in your project."* That is often an easier sell to a
maintainer than a rewrite, and it is worth saying so in the issue.

## You have already done the hard part

This is the argument for actually doing it, and it is a practical one rather than
a civic one: **by the time you have a working shim, the expensive work is
finished.** You have read the API, established the real signatures, and — because
you have been calling it — verified them against something more reliable than a
README.

The shim from chunk 03 is, near enough, the pull request. What is missing is
usually only:

1. **The parts you do not call.** Upstream declarations should cover the API, not
   your usage — the one place where chunk 04's "declare only what you use" advice
   is deliberately reversed.
2. **Tests.** DefinitelyTyped requires a `*.test-d.ts` style file exercising the
   declarations. This is the part that makes the types *checked* rather than
   claimed, and it is the reason upstream types are worth more than yours.
3. **The handbook's Do's and Don'ts.** A submission is reviewed against them —
   [topic 07 · chunks 10 and 11](../07-authoring-d-ts-files/10-designing-the-surface.md)
   are that checklist, and overload ordering and the boxed-primitive rule are the
   two that come up most.

## Keep the shim until it lands

Do not delete anything on the day you open the PR. The sequence that works:

```
1. shim in your repo, with a comment naming the upstream issue/PR
2. PR opened upstream
3. PR merged, released
4. install the released types
5. delete the shim — and let the build tell you it was redundant
```

⚠️ **Step 5 is the one that gets skipped**, and a stale shim then quietly shadows
the real types for years. Two things make it self-cancelling:

- **`@ts-expect-error` where you had a suppression.** It fails when the error
  disappears, which is precisely the signal you want
  ([Phase 10 · Why `@ts-expect-error` wins](../../phase-10-strictness/08-suppression-directives/02-why-expect-error-wins.md)).
- **A dated comment in the shim.** `// remove when @types/foo >= 3.2 ships —
  <link>` costs one line and is the only thing that will remind anybody.

📌 **A `paths` override is even more prone to this**, because it is invisible at
every call site (chunk 05). If you have one, the comment is not optional.

## When not to bother

Being honest about this is more useful than encouraging it uniformly:

- **The package is unmaintained.** An `@types` PR is still worth it — that is
  what DefinitelyTyped exists for — but a PR to a dead repository is not.
- **You use three functions of a large API.** Upstreaming means covering the
  whole surface. A local shim of three signatures is genuinely cheaper, and
  saying so is not laziness.
- **You are leaving the dependency.** If chunk 02's "is this still the right
  dependency?" question is heading towards no, do not invest in its types.
- **The types are wrong in a way that is a *behaviour* bug.** File the behaviour
  bug. A declaration that accurately describes broken behaviour is not an
  improvement.

## What this looks like as a habit

The reason this chunk closes the topic: **an untyped dependency is a small,
bounded, fixable piece of ecosystem debt**, and it is one of the few kinds a
single developer can genuinely retire. Every other fix in this topic moves the
cost around — from the compiler to your repository, from your repository to a
call site. Only this one removes it.

## Gotchas

**Symptom:** The upstream types landed and the build did not change.
**Cause:** A local shim or `paths` override is still shadowing them.
**Fix:** Delete it. Add a dated comment next time so the removal is prompted
rather than remembered.

**Symptom:** A stale shim silently shadowed correct upstream types for years.
**Cause:** Nothing failed when it became redundant — a shim that agrees with
reality is invisible.
**Fix:** Audit with `grep -rl "declare module '"`, and check each entry against
what the package ships now.

**Symptom:** Your DefinitelyTyped PR was rejected for style.
**Cause:** It is reviewed against the handbook's Do's and Don'ts — boxed
primitives, overload ordering, unused type parameters, `any`.
**Fix:** Read that page before submitting; it is short and it is the actual
review checklist.

**Symptom:** You upstreamed only the functions you use and it was sent back.
**Cause:** Upstream declarations describe the API, not one consumer's usage.
**Fix:** Cover the surface. This is the deliberate reversal of the local-shim
rule, and it is the main reason upstreaming costs more than shimming.

**Symptom:** The maintainer rejects "add TypeScript" as too large a change.
**Cause:** It was heard as "rewrite the library".
**Fix:** Propose `allowJs` + JSDoc + `declaration: true` instead — real
declarations generated from the existing JavaScript, no rewrite.

**Symptom:** `@types/foo` was updated and your code broke.
**Cause:** The `@types` package is versioned independently and may now describe a
different major.
**Fix:** Pin it alongside the library. This is the structural problem that
package-owned types remove entirely.

**Symptom:** You fixed the declaration upstream and the runtime bug remains.
**Cause:** The types were describing broken behaviour accurately.
**Fix:** File the behaviour bug separately. Making a wrong API well-typed is not
a fix.

**Symptom:** A colleague deleted the shim before the release landed.
**Cause:** The PR being merged was read as the fix being available.
**Fix:** Delete after installing the released version, not after the merge.

## Interview questions

**★ You have written a working shim. Why upstream it?**
Because the expensive work — reading the API and establishing the real signatures
— is already done, and every other fix leaves you owning something permanently.
Upstreaming is the only option that removes the cost rather than relocating it,
and the handbook explicitly invites it.

**★ DefinitelyTyped or the package itself?**
The package itself, when realistic. A separately versioned `@types` package is a
permanent source of version skew; a library that generates declarations from its
own source cannot drift, because the types are a projection of the code. Use
DefinitelyTyped when the maintainers will not ship types.

**★ A JavaScript maintainer says shipping types means rewriting in TypeScript.
What do you tell them?**
That it does not. `allowJs` with JSDoc annotations and `declaration: true`
generates real `.d.ts` from plain JavaScript — the flag's own description covers
"TypeScript **and JavaScript** files". No rewrite, and the types stop drifting.

**★ What changes between a local shim and an upstream submission?**
Coverage and verification. A local shim declares only what you call; upstream
declarations describe the whole API, and DefinitelyTyped requires type tests. The
tests are what make upstream types *checked* rather than claimed — the thing your
shim can never be.

**★ How do you make sure a shim is removed once real types ship?**
A dated comment naming the upstream PR, and `@ts-expect-error` rather than
`@ts-ignore` wherever there is a suppression — the latter fails when the error
disappears, which is the only automatic signal available. A shim that has become
redundant is otherwise completely silent.

**When is upstreaming not worth it?**
When the repository is dead, when you use three functions of a large API and
covering the whole surface costs far more than the shim, when you are leaving the
dependency anyway, or when the "wrong type" is really a behaviour bug that should
be filed as one.

**Why is a stale `paths` override worse than a stale shim?**
Because it is invisible at every call site — nobody reading the import can tell
the types came from somewhere else. A shim at least sits in a types directory
where an audit will find it.

**What is the one-line audit for this across a codebase?**
`grep -rl "declare module '"` over your types directory. Each hit is a package
you are describing by hand, and the list is the backlog. If the untypedness was
handled with casts and `@ts-ignore` instead, no such list exists — which is
chunk 04's argument for the shim.

---

← Prev: [05 · When the shipped types are wrong](./05-when-the-shipped-types-are-wrong.md) · Back to [the topic index](./README.md)
