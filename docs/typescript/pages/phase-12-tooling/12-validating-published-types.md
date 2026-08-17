---
title: "Validating published types"
sidebar_label: "12 · Validating published types"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **`arethetypeswrong`** and **`publint`**
> documentation for what each checks, the **Node.js** documentation on package
> `exports` and resolution, and the **`tsconfig` reference** for `moduleResolution`.
> ⚠️ **Neither tool is installed in this repository**, so their claims are
> documentation-attributed. **Publishing itself is
> [phase 6 · 11](../phase-6-modules-build/11-publishing-a-typed-package/README.md)'s**
> — this page owns **validating** it. **No sandbox run, no console block.**

Three findings in this phase have pointed at the same gap without naming it:

- 🔴 A wrong `rootDir` produces **a green build and a wrong package**
  ([topic 03 · chunk 02](./03-build-pipelines/02-the-two-shapes.md)).
- 🔴 `tsd` is a different tool because it runs against **the declarations consumers
  receive** ([topic 04 · chunk 02](./04-testing-types/02-exactness-any-and-choosing-a-tool.md)).
- 🔴 For a library, **the declaration build is the gate**
  ([topic 11](./11-declaration-emit.md)).

> **The gap they circle: every check so far has been run on your source tree, and
> what breaks a consumer is the published artefact.** Those are different objects,
> and nothing you have run compares them.

## 🔴 What actually goes wrong is resolution, not types

The types are usually fine. **What is wrong is that the consumer cannot find them,
or finds the wrong ones** — and that failure has nothing to do with type checking:

| Failure | What the consumer sees |
|---|---|
| `types` / `exports` pointing at a file that was not published | ⚠️ **implicit `any` everywhere**, or `TS7016` |
| ESM/CJS mismatch between the code and its declarations | the wrong shape, or a resolution error |
| declarations correct under one `moduleResolution` and not another | 🔴 **works for you, broken for them** |
| files omitted by the `files` field or `.npmignore` | a package missing its own types |

🔴 **The last column is the point: none of these is a type error.** Your compiler
was never asked the question, because the question is *"can a consumer, with their
settings, resolve and read this?"*

📌 **And it is why "it works in our monorepo" is weak evidence** — an internal
consumer often resolves your **source**, not your published files
([phase 6 · 12](../phase-6-modules-build/12-sharing-types-across-a-monorepo/README.md)),
so it exercises a path no external consumer takes.

## The two tools, and what each is for

| Tool | Question it answers |
|---|---|
| 🔴 **`arethetypeswrong`** | *"do the types resolve, under each module mode a consumer might use?"* |
| **`publint`** | *"is this package's manifest internally consistent and correctly published?"* |

**They are complementary rather than alternatives.** ⚠️ The first is specifically
about the **matrix**: a package can be perfectly correct under `node10` resolution
and broken under `node16`, and there is no single "correct" — **there is a set of
consumer configurations, and you either work under them or you do not.**

📌 **That matrix framing is the useful mental model even without the tool.** *"Does
it work?"* is not answerable for a published package; *"which of these five
resolution modes does it work under, and do I care about all five?"* is.

## 🔴 The check that needs no tools

Before either tool, there is a cheaper and more convincing test:

> **Pack the package and install it into an empty project. Import it. Hover
> something.**

**That is what a consumer does**, and it catches the whole first column above in one
step — including the failure that survives every other check, which is a file that
was never published at all.

⚠️ **Do it with the packed artefact, not a directory link.** A link resolves your
source tree and reproduces exactly the false confidence this topic is about.

## Where it goes in the pipeline

**On the release path, not the pull-request path** — it validates an artefact that
only exists at release time.

🔴 **Which makes it the exception to [topic 01 · chunk 03](./01-type-checking-in-ci/03-where-the-gate-goes.md)'s
rule that the deploy path should not re-check.** That rule was about *repeating* a
check already done; this is a **different** check that could not have been run
earlier, because its subject did not exist.

📌 **The distinction worth carrying: re-running a check you already ran is waste;
running a check on a new artefact is not.**

## Gotchas

**Symptom:** consumers report implicit `any` from your package and your build is
green.
**Cause:** the declarations were not published, or `types`/`exports` points at a
path that is not in the tarball.
**Fix:** 🔴 pack and install into an empty project. This is not a type problem and
no amount of type checking will surface it.

**Symptom:** it works in the monorepo and breaks for external consumers.
**Cause:** internal consumers often resolve your **source**, not the published
files.
**Fix:** ⚠️ treat internal use as no evidence at all for the published artefact.
They exercise a different path.

**Symptom:** it works for one consumer and not another, with the same version.
**Cause:** different `moduleResolution` settings — there is no single correct
answer, only a matrix.
**Fix:** `arethetypeswrong`, and decide which modes you support. 📌 Deciding is part
of the answer; supporting all of them is a choice, not a default.

**Symptom:** the package validates and the types are still wrong for consumers.
**Cause:** resolution and correctness are different questions — these tools answer
the first.
**Fix:** that is what `tsd` and the declaration build are for
([topic 04](./04-testing-types/README.md), [topic 11](./11-declaration-emit.md)).
⚠️ Do not read a green validation as a statement about the types themselves.

**Symptom:** the validation runs on every pull request and never fails.
**Cause:** it is checking an artefact that has not changed, or one built the same
way every time.
**Fix:** move it to the release path. 📌 It belongs where the artefact is produced,
which is also where a failure is actionable.

**Symptom:** a `files` field or `.npmignore` change silently dropped the
declarations.
**Cause:** publishing configuration is separate from build configuration and nothing
cross-checks them.
**Fix:** the pack-and-install test catches exactly this, which is why it is worth
doing even with the tools in place.

## Interview questions

**Why is a green build not evidence that your published types work?**
Because every check you have run was against your source tree, and what a consumer
receives is an artefact — a different object that nothing has compared to it. The
common failures are not type errors at all: declarations not included in the
tarball, `types`/`exports` pointing at a path that was not published, or a package
that resolves correctly under one module mode and not another.

**What do `arethetypeswrong` and `publint` each do?**
`arethetypeswrong` answers whether the types *resolve* under the various module
modes a consumer might use — the matrix. `publint` checks that the package manifest
is internally consistent and correctly published. They are complementary: one is
about resolution, the other about packaging hygiene.

**What is the cheapest useful version of this check?**
Pack the package, install it into an empty project, import it and hover something.
That is literally what a consumer does, and it catches the whole first class of
failures in one step — including a file that was never published. It has to be the
packed artefact rather than a directory link, because a link resolves your source
and reproduces the false confidence.

**Why is "it works in our monorepo" weak evidence?**
Because internal consumers frequently resolve your source rather than your published
output, so they exercise a path no external consumer takes. It is not weak evidence,
strictly — it is evidence about a different thing.

**Where does this belong in a pipeline, given the rule about not re-checking on the
deploy path?**
On the release path, and it is the honest exception. That rule was about repeating a
check already performed; this is a check that *could not* have run earlier, because
its subject — the artefact — did not exist until then. Re-running a check is waste;
checking a new object is not.

**Does a green validation mean your types are correct?**
No. These tools answer whether the types can be found and read, not whether they are
right. Correctness is what the declaration build and type tests are for, and reading
a resolution check as a correctness check is a common and expensive conflation.

---

← [11 · Declaration emit](./11-declaration-emit.md) · [Phase 12 index](./README.md)
