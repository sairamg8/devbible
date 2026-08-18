---
title: "The modern switch"
sidebar_label: "1 · The modern switch"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 361 (Switch Expressions, final in 14) and
> JLS §14.11 (the switch statement) / §15.28 (switch expressions).

**A switch *expression* produces a value, uses arrow labels that cannot fall
through, and must be exhaustive — the compiler proves every possible input
has an arm. Those three properties turn the switch from a control-flow hazard
into Java's best tool for "map this finite set of cases to outcomes", and the
exhaustiveness check in particular is a refactoring safety net nothing else
in the language provides.**

## Arrow labels: the form that cannot fall through

```java
DeliveryFee fee = switch (order.tier()) {
    case STANDARD        -> DeliveryFee.of(499);
    case EXPRESS         -> DeliveryFee.of(1299);
    case PICKUP, LOCKER  -> DeliveryFee.ZERO;      // multiple labels, one arm
};
```

Each `->` arm is self-contained: exactly one case's code runs, there is no
`break`, and forgetting one cannot merge two cases — the entire fall-through
bug class (chunk 2 catalogues it) is unrepresentable in this syntax. Multiple
labels share an arm with a comma, replacing the old stacked-empty-cases
idiom.

When an arm needs statements, a block with `yield` supplies the value:

```java
int fee = switch (tier) {
    case EXPRESS -> {
        audit.expressRequested(order);
        yield expressCalculator.fee(order);   // yield, not return
    }
    case STANDARD, PICKUP, LOCKER -> 499;
};
```

`yield` ends the *switch* with a value; `return` would end the *method* —
the distinction exists precisely because a switch expression can appear
anywhere an expression can.

## Exhaustiveness — the point of the whole feature

A switch **expression** must cover every possible value of its selector.
Over an enum, that means every constant (or a `default`); over a sealed type
(21+), every permitted subtype; over anything else, a `default` is required.

The payoff is what happens **later**. Say `OrderTier` gains a `PRIORITY`
constant next quarter:

- Every switch *expression* over it that lists constants **fails to
  compile** — the compiler hands you the complete list of code sites the new
  constant must be handled at. Nothing is forgotten, because forgetting is a
  build error.
- Every switch with a `default` arm compiles happily and routes `PRIORITY`
  wherever `default` goes — perhaps correctly, perhaps as the bug that
  surfaces in month-end reporting.

Hence the discipline: **over enums and sealed types, enumerate the cases and
omit `default`.** Write a `default` only when "everything else really is one
behaviour" is a *domain* statement, not a convenience. (The same trade
appears in Phase 2's sealed-interface modelling, where it decides API design;
TypeScript's version of this idea is devbible's discriminated-union
exhaustiveness story — same principle, different compiler.)

Two safety details underneath:

- The compiler also rejects *impossible* labels (a constant not of the
  selector's type) and *duplicate* labels.
- Exhaustiveness is checked at compile time, but the world can drift at run
  time — an enum serialized by a newer service, a recompiled dependency. The
  JVM therefore backs the guarantee with `MatchException`/
  `IncompatibleClassChangeError` rather than silent misbehaviour if an
  unmatched value actually arrives.

## Statement vs expression — choosing deliberately

Arrow labels also work in statement position (no value produced):

```java
switch (event.kind()) {
    case CREATED -> handleCreated(event);
    case UPDATED -> handleUpdated(event);
    case DELETED -> handleDeleted(event);
}
```

One asymmetry to know: a statement switch is **not** required to be
exhaustive — unlisted values fall through the whole statement and nothing
happens, silently. When each case's job is a side effect but you still want
the compiler's completeness proof, make it an expression anyway (yield a
result, or switch on the value and call methods in arms that return a
marker), or keep the statement form and accept that completeness is now a
code-review concern, not a compiler concern. For enum dispatch, the
expression form is almost always the better default for exactly this reason.

`if`/`else` chains remain right when conditions are *predicates* rather than
one value's cases — ranges, multi-variable conditions, boolean logic. The
switch earns its place when one selector has a finite set of shapes.

## Gotchas

**Symptom:** adding an enum constant broke the build in fourteen files
**Cause:** switch expressions without `default` over that enum — exhaustiveness now unsatisfied
**Fix:** this is the feature working. Each error site is a place the new constant genuinely needed a decision; handle them and the refactor is provably complete

**Symptom:** adding an enum constant broke *nothing*, and a subtle misrouting bug appeared weeks later
**Cause:** `default` arms swallowed the new constant everywhere
**Fix:** remove reflexive `default`s over enums and sealed types; re-enumerate. Keep `default` only where "anything else" is a real domain case

**Symptom:** `return` inside a switch-expression block exits the whole method unexpectedly — or fails to compile with a confusing message
**Cause:** conflating `yield` (produce the switch's value) with `return` (leave the method)
**Fix:** inside a switch-expression block, the value leaves via `yield`; `return` belongs to statement contexts

**Symptom:** a statement switch silently does nothing for some values
**Cause:** statement switches are not exhaustiveness-checked — unlisted cases skip the whole statement
**Fix:** prefer the expression form for enum dispatch; if a statement switch stays, add the missing cases or an intentional, commented `default`

**Symptom:** `MatchException` (or `IncompatibleClassChangeError`) from a switch that "provably" covered everything
**Cause:** compile-time exhaustiveness met run-time drift — an enum/sealed hierarchy from a newer or recompiled dependency delivered a value this class never knew
**Fix:** rebuild against the current dependency; in service boundaries that deserialize enums, treat unknown values as input validation (map to a domain "unknown" explicitly) rather than letting them reach the switch

**Symptom:** review debates about `switch (true)`-style predicate chains ported from other languages
**Cause:** the switch is for one selector's finite cases; predicates over ranges and multiple variables are `if`/`else`'s job
**Fix:** keep the boundary: selector-shaped logic → switch; predicate-shaped logic → `if`/`else` chain (or guarded patterns, chunk 2, when a selector *and* conditions combine)

## Interview questions

**★ What did switch expressions change relative to the old switch?**
Three things: they produce a value; arrow arms cannot fall through (no
`break` protocol); and they must be exhaustive, checked at compile time.
Together they convert the switch from a statement with a famous bug class
into a checked expression suitable for mapping finite cases to results.

**★ Why is omitting `default` over an enum considered the *stronger* style?**
Because exhaustiveness then re-checks every switch when the enum grows: a
new constant turns every unhandled site into a compile error — a complete,
compiler-generated to-do list. A `default` arm silently absorbs new
constants and converts missed handling into a run-time behaviour bug.

**★ What does `yield` do, and why couldn't `return` serve?**
`yield` terminates the enclosing switch *expression* with a value. `return`
terminates the enclosing *method* — inside an expression embedded in a
larger statement, that is a different (and usually wrong) meaning. Two exits,
two keywords.

**★ Is a switch *statement* with arrow labels exhaustive-checked?**
No — that is the asymmetry to remember. Statement switches may ignore
values silently; only expressions carry the completeness proof. For enum
dispatch where completeness matters, use the expression form even when arms
are side-effecting.

**How can an exhaustive switch still fail at run time?**
Separate compilation: the switch was exhaustive against the enum or sealed
interface it compiled with; a newer version of that type supplies a value
this code never saw. The JVM throws (`MatchException` family) instead of
picking an arm arbitrarily. It signals a version-drift problem, not a logic
error in the switch.

**When is an `if`/`else` chain still the right tool?**
When branching on predicates — ranges (`total > 10_000`), multi-variable
conditions, boolean combinations — rather than on one value's finite cases.
The switch's advantages (exhaustiveness, per-case arms) only exist when
there is a closed set of cases to enumerate.

---

← Index: [Control flow and the modern switch](README.md) · Next → [Patterns, null and the legacy switch](02-patterns-null-and-legacy.md)
