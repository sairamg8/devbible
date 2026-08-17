---
title: "The error message is the interface"
sidebar_label: "01 · The error is the interface"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Every diagnostic quoted here — `TS2322`, `TS2326`, `TS2328`,
> `TS2344`, `TS2345`, `TS6500`, `TS6502` — and its exact `{0}` placeholder text was
> read out of the **compiler's own numbered diagnostic table** (**TypeScript
> 5.9.3**, `sandbox/ts-p0`) and each string was then confirmed present in the
> installed **TypeScript 7.0.2** native compiler rather than recalled. **No
> sandbox, no console block** — no run covers this phase. The cost argument is
> stated as **judgement**, and marked where it appears.

You have spent seven topics learning to compute types. This one is about the fact
that **nobody else will ever read your type** — they will read what the compiler
prints when it rejects them.

> **A clever type that produces an unreadable error message is a net loss.**

That sentence has been forward-referenced from
[topic 01](../01-mapped-types/README.md),
[topic 02 · chunk 04](../02-conditional-types/04-readable.md) and
[topic 07](../07-template-literal-types.md), and it is not a slogan. It is a claim
about **who pays**, and the arithmetic behind it is what makes it a rule rather
than a preference.

## The cost asymmetry, stated properly

A computed type is written **once**, by someone who has the whole design in their
head, in a state of understanding it will never be read in.

It is failed against **many times**, by people who:

- did not write it,
- do not know it exists,
- are already stuck on something else (that is *why* they hit it),
- are reading its output as an obstacle rather than as documentation, and
- have no idea which of the type's twelve moving parts is the one that rejected
  them.

So the author pays once, at their moment of maximum context, and every reader pays
at their moment of minimum. **A type-level program's real interface is its failure
mode**, and the failure mode is the one part most authors never look at.

⚠️ **The corollary people resist:** a type that is *correct* can still be a net
loss. Correctness is the author's concern; legibility of failure is everyone
else's, and there are far more of them.

📌 **Library code inverts the ratio, not the rule.** A type in a package used by a
thousand projects is read by more strangers than any application type, so its
failure mode matters *more*, not less — which is why the well-known libraries
invest in error-message design that application code cannot justify.
[Chunk 06](./06-the-cases-that-earn-it.md) is where that case is made properly.

## What the compiler can and cannot tell them

This is the mechanical reason a computed type fails badly, and it is worth being
precise about, because it decides every recommendation in this topic.

**The checker reports on the type it ended up with, not on the program that
produced it.** There is no diagnostic that says *"the third branch of your
conditional did not match"*, because the compiler has no vocabulary for branches —
by the time assignability is checked, the conditional has already resolved to a
type and the branches are gone. The same is true of a mapped type's iterations and
a template literal's expansion: they are steps, and steps are not reportable.

What it has instead is a small, fixed set of assignability messages:

> **`TS2322`: Type `'{0}'` is not assignable to type `'{1}'`.**
>
> **`TS2345`: Argument of type `'{0}'` is not assignable to parameter of type
> `'{1}'`.**
>
> **`TS2326`: Types of property `'{0}'` are incompatible.**
>
> **`TS2328`: Types of parameters `'{0}'` and `'{1}'` are incompatible.**

Those `{0}` and `{1}` slots are filled with whatever your type computed. If it
computed something with a name, the reader sees a name. If it computed an anonymous
expansion — and a mapped type over a conditional over a union almost always does —
the reader sees the expansion, in full, as a wall.

`TS2326` and `TS2328` are the *nesting*: they are how a deep mismatch is walked
property by property and parameter by parameter, one line per level. That is why a
deriving-heavy codebase produces the forty-line errors it is famous for — the depth
of the message tracks the depth of your type, and your type is deep on purpose.

## Constraints are the exception, and that is the whole lever

A constraint failure is reported *before* any computation happens:

> **`TS2344`: Type `'{0}'` does not satisfy the constraint `'{1}'`.**

That message names the constraint **the author wrote**, at the call site **the
caller wrote**. It is the only diagnostic in this topic that points at a decision a
human made, rather than printing a value a machine derived.

Everything in [chunk 02](./02-three-designs-and-the-fix.md) and
[chunk 05](./05-keeping-the-ones-you-keep.md) about "constrain the input instead of
handling nonsense in a branch" comes back to this one message existing.

## The compiler *can* point at a declaration — just not at a branch

Two related-information messages are worth knowing, because they are what a
readable failure looks like when the language cooperates:

> **`TS6500`: The expected type comes from property `'{0}'` which is declared here
> on type `'{1}'`**
>
> **`TS6502`: The expected type comes from the return type of this signature.**

These are pointers to *source locations*. A property declared in an interface, a
return type written in a signature — the compiler can take the reader there, and an
editor will jump on click.

It cannot take them to "the branch that failed", because that is not a location; it
is a step in a computation that has already been discarded.

> 🔴 **That is the trade you make every time you replace a written type with a
> computed one:** you swap a diagnostic that can point at a declaration for one that
> can only print a value.

Which is fine when the computation is the point — one source of truth, twenty
derived shapes. It is a bad trade when the "computation" has three possible inputs
and you could have written the three types out.

## Where this leaves the rest of the topic

Three facts, and every recommendation later is downstream of them:

1. **Failures print types, not programs.** So the readability of a type-level
   program is the readability of its *output*, and the fix is naming
   ([chunk 02](./02-three-designs-and-the-fix.md)).
2. **Constraints fail early and by name.** So bad input should be excluded by a
   bound, never handled by a fallback branch.
3. **Enumerable candidates produce enumerable errors.** So a design the compiler
   can list — overloads, a discriminated union — reports better than one it must
   resolve. That is [chunk 03](./03-what-to-write-instead.md)'s subject, with the
   documented caveats attached.

## Gotchas

**Symptom:** An error names a type nobody wrote — a long anonymous object or
intersection.
**Cause:** The computed type had no alias, so the compiler filled `{0}` with
structure instead of a name.
**Fix:** Extract named aliases for every intermediate step
([chunk 02](./02-three-designs-and-the-fix.md)).

**Symptom:** A forty-line error with a dozen `Types of property` lines.
**Cause:** `TS2326`/`TS2328` nesting — the message walks one level per level of
your type, and derived types are deep by design.
**Fix:** Reduce the depth, or make the mismatch fail earlier at a bound. Reading
such an error bottom-up is
[phase 10 · chunk 04](../../phase-10-strictness/04-reading-a-typescript-error.md).

**Symptom:** A caller's mistake produces no error at all; a `never` shows up
elsewhere.
**Cause:** The type parameter was unconstrained, so bad input matched the signature
and fell through to the fallback.
**Fix:** Constrain it, so the caller gets `TS2344`/`TS2345` at the call site.

**Symptom:** The error points at a function boundary rather than the mistake.
**Cause:** The computed type resolved silently and only failed where its result was
consumed.
**Fix:** Move the check earlier — a bound on the parameter, or an annotation on the
intermediate value so it is validated at its declaration.

**Symptom:** You want the error to say "you passed the wrong `kind`" and cannot
make it.
**Cause:** There is no diagnostic for "your input did not match my intent". The
compiler only has assignability.
**Fix:** Encode the intent *as* the type — a named constraint, or a named
error-message type in the fallback ([chunk 05](./05-keeping-the-ones-you-keep.md)).

**Symptom:** An error mentions a type from a library the caller has never imported.
**Cause:** Your derived type expanded through the library's aliases, and the
compiler printed the resolution.
**Fix:** Alias the boundary type in your own code so the printed name is one your
callers recognise.

**Symptom:** The same mistake reports differently in two call sites.
**Cause:** In one place inference had a literal to work with; in the other a widened
type, so the computation resolved differently before any comparison.
**Fix:** Expected. Judge the message from the widened case too — that is the one
your callers will usually hit.

**Symptom:** Reviewers approve the type and then avoid the file.
**Cause:** The readability cost, expressed as behaviour rather than as a comment.
**Fix:** Take it as the signal it is. It is the most reliable measurement in this
topic and the only one that arrives unprompted.

## Interview questions

**★ Why is a computed type's error message described as its interface?**
Because it is the only part of it most people will ever read. The type is written
once by someone holding the whole design; it is failed against many times by people
who did not write it, do not know it exists and are already stuck. The author pays
once at maximum context, every reader pays at minimum — so the failure mode, not
the mechanism, is what the type actually contributes to a codebase.

**★ Mechanically, why can the compiler not tell a caller which branch of a
conditional type failed?**
Because assignability is checked against the *result*. By the time anything is
compared, the conditional has resolved to a single type and the branches no longer
exist — the same goes for a mapped type's iterations. The available diagnostics are
assignability messages (`TS2322`, `TS2345`, `TS2326`, `TS2328`) whose placeholders
are filled with whatever the type computed. There is no "branch" concept for the
checker to report on.

**★ Why is `TS2344` the most useful diagnostic in this phase?**
Because it is the only one that reports on something a human wrote rather than
something the compiler computed: *"Type `'{0}'` does not satisfy the constraint
`'{1}'`."* names the constraint, at the call site. Every other message here prints a
value. That is the argument for constraining a type parameter instead of accepting
anything and computing `never` for the rest.

**What do `TS6500` and `TS6502` show about the limits of type-level reporting?**
They are the compiler pointing at a *source location* — a property declaration, a
signature's return type — because those are things people wrote. It cannot do the
same for a branch of a conditional or an iteration of a mapped type, which are
steps in a computation rather than locations. Deriving a type instead of writing one
trades a diagnostic that can point at a declaration for one that can only print a
value.

**Why do derived types produce such long error messages specifically?**
Because `TS2326` *"Types of property `'{0}'` are incompatible."* and `TS2328`
*"Types of parameters `'{0}'` and `'{1}'` are incompatible."* nest — one line per
level of structure the checker had to descend. A derived type is deep on purpose,
so the message is deep as a consequence. The length is not a bug in the compiler;
it is a faithful report of the shape you built.

**Somebody says "the type is correct, the error is just ugly". Is that a defence?**
No. Correctness is the author's concern and legibility of failure is everyone
else's, and there are more of them. A correct type whose failure is unreadable
still costs the team more than the bug it prevents — which is precisely what the
phase's rule says.

**Does this argument apply to library authors too?**
It applies harder. A library type is failed against by more strangers than any
application type, so its failure mode is a bigger share of its value — which is why
mature libraries spend effort on custom error-message types that application code
could never justify. The rule does not reverse for libraries; the ratio that
motivates it gets larger.

**If failures print types rather than programs, what follows for how you write
them?**
Three things: name every intermediate so the compiler has something to print;
exclude bad input with a bound rather than a fallback branch, so the failure is
`TS2344` at the call site; and prefer designs the compiler can *enumerate* over ones
it must resolve, because a list of candidates can be listed in the error and a
resolved type cannot.

---

← [Topic index](./README.md) · Next → [02 · Three designs, and the fix](./02-three-designs-and-the-fix.md)
