---
title: "Exactness, `any`, and choosing a tool"
sidebar_label: "02 · Exactness and `any`"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **Vitest's** *Testing Types* documentation for
> `expectTypeOf`, its `toEqualTypeOf` / `toMatchTypeOf` distinction and
> `assertType`, and the **`tsd`** documentation. ⚠️ **Neither is installed here**, so
> tool behaviour is documentation-attributed; **the reasoning about `any` below is
> argued from assignability rather than measured**, and is marked where it is
> inference rather than quotation. **No sandbox run, no console block.**

[Chunk 01](./01-a-test-whose-runner-is-the-compiler.md) established that the useful
half of type testing is asserting that wrong usage is **rejected**. This chunk is
about the positive half where you do write it — because there are two ways to get it
wrong that make an assertion weaker than it looks.

## 🔴 Equal is not the same as assignable

Type-testing libraries offer both, and the distinction is the whole game:

| Assertion | Asks | Passes when |
|---|---|---|
| `toEqualTypeOf<T>()` | *are these the same type?* | ✅ exactly `T` |
| `toMatchTypeOf<T>()` | *is this assignable to `T`?* | ⚠️ **`T` or anything narrower** |

**Assignability is one-directional**, so the second is a much weaker claim than it
reads as. `{ id: string; name: string }` is assignable to `{ id: string }` — so a
test asserting the result "matches" `{ id: string }` passes even if the function has
started returning an entirely different, larger object.

🔴 **Default to the exact form.** The assignable form is right when you genuinely
mean *"at least this"* — a constraint check on a generic — and using it out of habit
turns a test into a formality.

## 🔴 `any` defeats the naive version of both

Here is the property that matters, and it follows from what `any` *is* rather than
from any library's implementation:

> **`any` is assignable to everything, and everything is assignable to `any`.**

⚠️ **So a check implemented purely as "assignable in both directions" reports that
`any` equals every type.** A suite built that way passes completely when your types
degrade to `any` — which is precisely the regression you most wanted to catch
([phase 10 · 03 · Containing `any`](../../phase-10-strictness/03-containing-any.md)),
because it is the one that produces no other symptom.

📌 **Serious type-testing libraries handle this deliberately** — Vitest's
documentation calls out that `toEqualTypeOf` distinguishes `any` from a concrete
type, and `tsd` reports `any` as its own kind of failure. **Which is the reason to
use one rather than hand-rolling an assertion helper**: a five-line
`assertAssignable<A, B>()` looks equivalent and is silently blind in the one case
that matters.

🔴 **The check worth running once on any type-test suite you inherit:** assert that
something is `string` when it is really `any`. **If that passes, the suite is
decorative.**

## The other blind spot: optionality and `undefined`

Two more places an "equal" claim is weaker than it reads, both worth knowing because
they are where API changes actually happen:

- **`{ a?: string }` vs `{ a: string | undefined }`** — different types, and
  `exactOptionalPropertyTypes` is what makes the difference bite
  ([phase 10 · 05](../../phase-10-strictness/05-exactoptionalpropertytypes/README.md)).
  ⚠️ **A test written before that flag was enabled may be asserting the wrong one of
  the two.**
- **Union order and inference shape.** A test that pins a *computed* type — the
  result of a conditional or a mapped type — is asserting an implementation detail,
  and will fail on refactors that changed nothing observable. 📌 **Assert what a
  caller can perceive**, not the shape the compiler happened to produce.

## Choosing a tool

| | Fits |
|---|---|
| **`expectTypeOf` in your test runner** | tests live beside the unit tests, one command, one config |
| **`tsd`** | a **published package's public surface**, checked as a consumer sees it |

📌 **The distinction is what is being tested, not preference.** `tsd` runs against
your declaration files — the thing consumers actually get — which makes it a check on
the *published artefact* rather than on your source. ⚠️ **That is the same
distinction [topic 03 · chunk 02](../03-build-pipelines/02-the-two-shapes.md) draws
about `rootDir`**: your sources being right does not prove the package is, and only a
consumer-side check closes that gap.

🔴 **And whichever you choose, the type tests are in your gate's program** — so they
add to check time, a broken one fails the build, and they are subject to
[topic 01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)'s
coverage question. **That is the cost, and it is the correct cost: a type test that
does not fail the build is not one.**

## Gotchas

**Symptom:** a type test passes and the return type is visibly wrong.
**Cause:** `toMatchTypeOf` — the actual type is assignable to the expected one, which
a wider or narrower object can be.
**Fix:** 🔴 use the exact form by default. Keep the assignable form for genuine
*"at least this"* claims.

**Symptom:** the types degraded to `any` and the whole type-test suite still passed.
**Cause:** an assignability-based equality check — `any` is assignable in both
directions, so it "equals" everything.
**Fix:** use a library that treats `any` specially, and 🔴 **verify it: assert
`any` is `string` and confirm it fails.** If it passes, the suite is decorative.

**Symptom:** somebody wrote a small in-house `assertAssignable` helper.
**Cause:** it looks equivalent and is five lines.
**Fix:** ⚠️ it is blind to `any` in exactly the case you care about. This is the
concrete reason to take the dependency.

**Symptom:** type tests fail after a refactor that changed no behaviour.
**Cause:** they pin a computed type — a conditional or mapped result — rather than
what a caller perceives.
**Fix:** assert the observable shape. 📌 A test that breaks on internal detail gets
deleted after the second time, which costs you the assertions that were good.

**Symptom:** an optional-property assertion started failing when a flag was enabled.
**Cause:** `{ a?: string }` and `{ a: string | undefined }` are different types, and
`exactOptionalPropertyTypes` makes the difference visible.
**Fix:** decide which one the API means and assert that. The failure is the flag
doing its job.

**Symptom:** the package ships with a broken public type and the type tests were
green.
**Cause:** they tested the source, not the declarations consumers receive.
**Fix:** ⚠️ a consumer-side check — the same argument as validating the published
package, and the reason `tsd` exists as a separate tool.

## Interview questions

**What is the difference between `toEqualTypeOf` and `toMatchTypeOf`?**
Equality versus assignability. Assignability is one-directional, so "matches" passes
for anything narrower — a function that starts returning a much larger object still
satisfies a `toMatchTypeOf<{ id: string }>` assertion. Default to the exact form and
reserve the assignable one for genuine "at least this" claims.

**Why is `any` a problem for type tests?**
Because `any` is assignable to everything and everything is assignable to `any`, so a
check implemented as "assignable both ways" concludes that `any` equals every type. A
suite built that way passes completely when your types degrade to `any` — the exact
regression you most want to catch, since it produces no other symptom.

**How would you check a type-test suite is worth anything?**
Two experiments. Break an assertion and confirm the type-check step goes red, which
proves the files are in the checked program. Then assert that something typed `any`
equals `string`; if that passes, the suite cannot detect the most important
regression there is.

**Why not write your own assertion helper?**
Because a five-line assignability helper looks equivalent and is silently blind to
`any`. Handling that case deliberately is the main thing the established libraries
do that a hand-rolled one does not, and it is the case that matters most.

**When would you use `tsd` rather than your test runner's helpers?**
When what you want to test is the *published surface* — `tsd` runs against your
declaration files, which is what consumers actually receive. Testing your source does
not prove the package is right; that is the same gap that makes a wrong `rootDir`
produce a green build and a broken package.

**What do type tests cost?**
They live in the gate's program, so they add to check time and a broken one fails the
build. That is the correct cost rather than a drawback — a type test that cannot fail
the build is not a test — but it does mean they are subject to the same coverage
question as everything else the gate checks.

---

← [01 · A test whose runner is the compiler](./01-a-test-whose-runner-is-the-compiler.md) · [Topic index](./README.md) · [Phase 12 index](../README.md)
