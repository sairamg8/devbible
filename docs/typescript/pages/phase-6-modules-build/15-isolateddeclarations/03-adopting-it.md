---
title: "Adopting it — the cost and the payoff"
sidebar_label: "03 · Adopting it"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the option record's flag pair (`affectsBuildInfo` +
> `affectsSemanticDiagnostics`) and the `TS9027`–`TS9036` quick-fix labels are
> read from the installed **TypeScript 5.9.3** build. The `declaration`/
> `composite` interactions are the **TSConfig reference**'s, and the
> stable-declaration argument is topics 13 and 14's. **No sandbox, no console
> blocks** — and **no speed figure is claimed**, because none was measured.

The seventeen diagnostics in [chunk 02](./02-the-diagnostics.md) look like a
large migration. Two things make it much smaller than it looks, and one thing
makes it larger.

## Smaller than it looks

**1. It only applies to exports.** Nothing internal to a module needs annotating.
In a typical package the exported surface is a small fraction of the code, and
`index.ts` files are often already fully annotated because they were written as
an API.

**2. 🔴 Almost every requirement has an automated fix.** `TS9027`–`TS9036` are
the editor's fix-menu labels — *"Add a return type to the function
declaration"*, *"Add a type annotation to the variable"*, and for the awkward
cases *"Add satisfies and a type assertion to this expression (`satisfies T as
T`) to make the type explicit"*.

> **Turn the flag on, take the fix-all, review the diff.** That is the realistic
> shape of the migration, not hand-annotating hundreds of functions.

⚠️ **Review the diff properly, though.** A fix-all writes the type the compiler
*currently infers*, which is not always the type you *meant*. An inferred
`{ ok: boolean; value: string }` becoming a written annotation freezes a shape
that might have wanted a named interface — and it is much harder to notice later.

## Larger than it looks

**The patterns it bans have no annotation-based fix.** From
[chunk 02](./02-the-diagnostics.md)'s structural group:

- 🔴 **Mixin factories** — `TS9021` + `TS9022`, and the shape is the problem.
- **Exported binding elements** (`TS9019`), enum initialisers referencing
  external symbols (`TS9020`), property-assignment on functions (`TS9023`).
- **Default exports of expressions** (`TS9037`) — fixable, but by *restructuring*
  into a named variable with an annotation, which the compiler even suggests
  (`TS9036`).

📌 **Survey for those before committing to the flag.** They are the part that
turns a mechanical migration into a design conversation, and a quick grep for
`extends ` on a function return, or for `export default` followed by an
expression, tells you the size of it in minutes.

## Does it actually make your build faster?

**Not by itself, and this is where most write-ups overclaim.**

The flag does not change what `tsc` does. It is a *precondition* — it makes a
different toolchain possible:

```
before                              after — but only if you also change the build
────────────────────────────        ────────────────────────────────────────────
tsc → .js + .d.ts                   esbuild/swc  → .js      (parallel)
                                    a d.ts tool  → .d.ts    (parallel)
                                    tsc --noEmit → checking (off the critical path)
```

🔴 **If you enable the flag and keep emitting with `tsc`, your build time is
unchanged.** What you get instead is the second-order benefit that costs nothing:

- **Stable declarations.** Annotated public types do not move when
  implementations do, which is exactly what
  [`TS6354`](../13-project-references/02-the-up-to-date-check.md) and the
  incremental [`signature` hash](../14-incremental-builds/02-what-invalidates-it.md)
  reward. In a deep `composite` graph that is a real, compounding saving.
- **Better errors and stabler APIs**, because a written type is a decision rather
  than a consequence.

⚠️ **No number appears here because none was measured.** How much a parallel
emit path wins depends entirely on your codebase and your toolchain.
`tsc --extendedDiagnostics` on your own repo is the honest way to find out;
**Phase 12 · Tooling, performance and testing** *(not written yet)* owns compiler
performance in general.

## The adoption order

Each step leaves the repo working, and the order matters:

**1. Survey the structural bans first.** Mixins, exported bindings, expression
default exports. If a core pattern is banned, decide *that* before doing any
annotation work.

**2. Enable it on one leaf package.** Ideally one that already publishes, since
[topic 11](../11-publishing-a-typed-package/README.md) means its declarations
are the deliverable anyway.

**3. Fix-all, then review the diff.** Look specifically for inferred shapes that
should have been named types.

**4. Spread outward through the dependency graph**, leaves first — a package's
exported types are simpler to annotate when its dependencies' types are already
explicit.

**5. Only then change the emit toolchain**, if that was the goal. The flag is
step 5's precondition, not its substitute.

🔴 **Do not enable it repo-wide on day one.** The structural bans surface all at
once, mixed in with thousands of mechanical fixes, and the two need completely
different responses.

## Where it sits in a config

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "isolatedDeclarations": true
  }
}
```

📌 It carries **`affectsSemanticDiagnostics`**, so it changes what is reported —
and **`affectsBuildInfo`**, so toggling it invalidates the incremental cache
([topic 14 chunk 02](../14-incremental-builds/02-what-invalidates-it.md)). Expect
one slow build when you turn it on, per package.

## Gotchas

**Symptom:** The flag was enabled and the build is exactly as slow.
**Cause:** `tsc` is still emitting. The flag is a precondition, not an
optimisation.
**Fix:** Change the emit toolchain, or adopt it for the stable-declaration
benefit and say so.

**Symptom:** A fix-all produced hundreds of annotations and a reviewer approved
them unread.
**Cause:** The diff looks mechanical.
**Fix:** It freezes currently-inferred shapes. Review for ones that should be
named types.

**Symptom:** Adoption stalled on a mixin factory.
**Cause:** `TS9021` + `TS9022` — no annotation fixes it.
**Fix:** Survey for these *before* starting. It is a design decision, not a
migration step.

**Symptom:** Enabling it repo-wide produced thousands of errors of every kind at
once.
**Cause:** Mechanical and structural failures arriving together.
**Fix:** One leaf package first, then outward.

**Symptom:** A slow build the first time it is enabled per package.
**Cause:** `affectsBuildInfo` — the incremental cache is invalidated.
**Fix:** Expected, once, per package.

**Symptom:** Annotating a package felt harder than expected.
**Cause:** Its dependencies' exported types were still inferred.
**Fix:** Leaves first. Explicit dependency types make dependents easier.

**Symptom:** Someone proposes it purely for "type safety".
**Cause:** It does improve API stability, but that is not its purpose.
**Fix:** Fine as a reason if named honestly. Its category is
`Interop_Constraints`.

**Symptom:** An `export default someExpression()` cannot be annotated.
**Cause:** `TS9037`.
**Fix:** Move it to a named, annotated variable and export that — which is
exactly what `TS9036` suggests.

## Interview questions

**★ How large is an `isolatedDeclarations` migration, really?**
Smaller than the diagnostic count suggests for the mechanical part — it applies
only to exports, and `TS9027`–`TS9036` are quick-fix labels, so most of it is
fix-all plus a diff review. Larger for the structural bans, which have no
annotation-based fix and are a design conversation.

**★ Does enabling it speed up your build?**
Not by itself. It is a precondition that lets a non-`tsc` tool emit declarations
in parallel; if you keep emitting with `tsc`, build time is unchanged. What you
do get for free is stable declarations, which is what `TS6354` and the
incremental `signature` hash reward.

**★ What is the risk in a fix-all?**
It writes the type the compiler currently infers, freezing a shape that may have
wanted a named type. The diff looks mechanical and is not — review it for
inferred object shapes that should be interfaces.

**★ What should you check before committing to it?**
The structural bans: mixin factories (`TS9021`/`TS9022`), exported binding
elements, enum initialisers referencing external symbols, property assignment on
functions, and expression default exports. A grep finds them in minutes and they
determine whether this is a migration or a redesign.

**In what order do you adopt it across a monorepo?**
Survey the structural bans, then one leaf package — ideally one that already
publishes — then fix-all and review, then outward through the graph leaves-first,
and only then change the emit toolchain if that was the point.

**Why does the first build after enabling it take longer?**
`affectsBuildInfo` — the incremental cache is invalidated, once, per package.

**Why leaves-first rather than the top?**
Because a package's exported types are easier to annotate when its dependencies'
types are already explicit rather than inferred.

---

← Prev: [02 · The diagnostics](./02-the-diagnostics.md) · Back to [the topic index](./README.md)
