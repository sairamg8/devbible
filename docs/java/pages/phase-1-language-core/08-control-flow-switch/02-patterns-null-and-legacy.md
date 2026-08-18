---
title: "Patterns, null and the legacy switch"
sidebar_label: "2 · Patterns, null, legacy"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against JEP 441 (Pattern Matching for switch, final in
> 21), JLS §14.11.1 (switch labels and dominance), and JLS §14.15 / §14.7
> (labeled statements, break/continue).

**Since Java 21 a switch can select on *type*: `case Timeout t ->` binds and
narrows in one label, guards add conditions with `when`, and `case null`
finally gives null an arm instead of an automatic exception. This chunk
covers the pattern machinery, the null rule everyone learns the hard way,
the fall-through legacy you will keep meeting in old code — and the loop
constructs that round out control flow.**

## Type patterns: the `instanceof` ladder, retired

```java
String describe(PaymentEvent event) {
    return switch (event) {
        case Authorized a          -> "auth " + a.transactionId();
        case Declined d            -> "declined: " + d.reason();
        case Refunded r when r.isPartial() -> "partial refund " + r.amount();
        case Refunded r            -> "full refund";
    };
}
```

Each label tests, casts and binds in one step — the pattern variable (`a`,
`d`, `r`) is in scope only in its arm. With `PaymentEvent` a **sealed**
interface, no `default` is needed and exhaustiveness covers the hierarchy:
add a `Chargeback` subtype and every such switch fails to compile until it
answers for it. Sealed-hierarchy design — why to model domain results this
way at all — is **Phase 2's sealed-types topic** *(not written yet)*; this
page is the dispatch half. (Record deconstruction patterns —
`case Point(int x, int y)` — belong to the same Phase 2 story.)

Two compiler rules keep pattern switches honest:

- **Guards** (`when clause`) add a boolean condition to a pattern label; a
  guarded label that fails its guard falls to *later* labels, so ordering
  matters — put guarded cases before their unguarded catch-all.
- **Dominance**: a label that can never match because an earlier label
  already covers it (`case Object o` before `case String s`) is a compile
  error, not a silent dead arm.

## `case null` — the rule and the escape

The legacy behaviour, still the default: **switching on a null selector
throws `NullPointerException` before any label is consulted** — for the old
statement switch, for expressions, for pattern switches alike. A total
pattern like `case Object o` does *not* catch null; null belongs to no type
pattern.

Java 21 added the opt-in:

```java
return switch (status) {              // status may be null from the wire
    case null        -> Status.UNKNOWN;      // explicit arm — no NPE
    case "ACTIVE"    -> Status.ACTIVE;
    case "SUSPENDED" -> Status.SUSPENDED;
    default          -> Status.UNKNOWN;
};
// shorthand when null and default share behaviour:  case null, default -> ...
```

The design reading: null-hostility stays the default so that the thousand
existing switches keep their fail-fast semantics; a switch that *means* to
handle null now says so in the source, visibly. If a null selector reaches a
switch that has no `case null`, that NPE is [topic 13's](../13-null-and-npe/README.md)
boundary discussion in miniature — decide whether null was a legal input
(handle it) or a bug upstream (let it throw, fix the source).

## The legacy statement switch — reading old code safely

Pre-14 switches use colon labels, `break`, and fall-through:

```java
switch (code) {
    case 1:
    case 2:
        handleSmall();
        break;          // omit this and case 3's code ALSO runs
    case 3:
        handleLarge();
        break;
    default:
        reject();
}
```

Fall-through was designed for sharing an arm across labels (cases 1 and 2
above); its cost is that a *forgotten* `break` merges unrelated cases
silently — no warning, tests pass until the merged case is exercised. The
recognition checklist for legacy code: stacked labels are usually
intentional; a non-empty case without `break` is either a deliberate
cascade (grep for a `// fall through` comment — conventional, and required
by many linters) or the bug. New code simply uses arrow labels, where the
hazard cannot be written. Colon-label switches also scope all case bodies as
one block — a variable declared in one case is visible (but possibly
unassigned) in later ones, a second classic confusion arrows eliminated.

## Loops, and the labels you'll rarely use

The enhanced `for` is the default iteration everywhere an index is not
itself the point (`for (Order o : orders)`); it works over arrays and any
`Iterable` — implementing your own is **Phase 3's `Iterable` topic** *(not
written yet)*, and removing during iteration is Phase 3's
`ConcurrentModificationException` story. Classic `for` remains for index
math; `while`/`do-while` for condition-driven repetition.

`break` and `continue` act on the innermost loop — except with **labels**:

```java
search:
for (Warehouse w : warehouses) {
    for (Bin bin : w.bins()) {
        if (bin.contains(sku)) { found = bin; break search; }  // exits BOTH
    }
}
```

A labeled `break` is the clean exit from nested loops (the alternative being
flag variables checked at each level). Used sparingly it is clearer than the
workarounds; used routinely it is a sign the nested loops want to be a
method whose `return` does the job.

## Gotchas

**Symptom:** `NullPointerException` from the switch line itself, before any case runs
**Cause:** null selector — switches throw on null unless a `case null` label exists; `default` and `case Object o` do not cover null
**Fix:** add `case null ->` (or `case null, default ->`) when null is a legal input; otherwise fix the upstream that produced null — the NPE names the right line

**Symptom:** compile error "this case label is dominated by a preceding case label"
**Cause:** a broader pattern listed before a narrower one — `case Object o` before `case String s`
**Fix:** order patterns specific-first; the compiler is telling you an arm was unreachable, which in an `instanceof` ladder would have been a silent bug

**Symptom:** a guarded case never fires though its condition is plainly true sometimes
**Cause:** an earlier unguarded pattern of the same type consumes every match before the guard is consulted
**Fix:** guards refine — place `case Refunded r when r.isPartial()` *before* `case Refunded r`, never after

**Symptom:** legacy switch executes two cases' logic for one input
**Cause:** missing `break` — fall-through merged adjacent cases
**Fix:** add the `break` (and a regression test for the previously-merged case); when touching the file anyway, convert to arrow labels so the class of bug becomes unwritable

**Symptom:** "variable might not have been initialized" for a variable declared in an earlier case of a colon switch
**Cause:** colon-label switches share one scope across all cases; the declaration is visible but its assignment only ran if that case executed
**Fix:** braces around the case body, or arrow labels — each arrow arm is its own scope

**Symptom:** a pattern switch over an interface insists on a `default` you don't want
**Cause:** the interface isn't sealed — the compiler cannot enumerate implementations, so exhaustiveness by cases is impossible
**Fix:** seal the hierarchy if you own it and the set is genuinely closed (Phase 2's modelling decision); otherwise the `default` is honest — the set really is open

**Symptom:** deeply nested loops with `done` flags checked at every level
**Cause:** avoiding labeled `break` on principle
**Fix:** one label reads better than three flags — or extract the search into a method and let `return` be the exit

## Interview questions

**★ What happens when a switch's selector is null, and how did Java 21 change it?**
Default: immediate `NullPointerException`, before any label — including
`default` — is considered. Java 21 added `case null` as an explicit opt-in
arm (combinable as `case null, default`). Existing null-hostile behaviour
was preserved deliberately: handling null must now be visible in source.

**★ How do pattern switches interact with sealed interfaces?**
The compiler knows a sealed interface's complete set of permitted subtypes,
so a switch expression listing them all is exhaustive with no `default` —
and grows a compile error at every switch when a new subtype is added.
This pairing (sealed hierarchy + pattern switch) is Java's algebraic data
type: closed domain model, compiler-verified handling.

**★ What is pattern dominance and why is it an error rather than a warning?**
A label dominated by an earlier one (`case String s` after `case Object o`)
can never match — in an `instanceof` ladder that's a silent dead branch, a
real bug shape. The switch promotes it to a compile error because the
compiler can see the whole label list at once.

**★ Where do guarded patterns go relative to unguarded ones, and why?**
Before. `case Refunded r when r.isPartial()` must precede `case Refunded r`
— an unguarded pattern matches every `Refunded`, so anything after it of the
same type is dominated. Guard order is evaluation order.

**Why was fall-through ever a feature, and what replaced its legitimate use?**
It let adjacent labels share one arm (cases 1 and 2 run the same code) —
the C heritage. Arrow labels replaced that use with comma-separated label
lists (`case PICKUP, LOCKER ->`), keeping the sharing and deleting the
forgotten-`break` hazard.

**When is a labeled `break` the right call?**
Exiting nested loops on a found condition — one label beats cascading flag
variables. If labels appear regularly, the loops usually want extraction
into a method where `return` is the natural exit.

---

← Prev: [The modern switch](01-the-modern-switch.md) · Index: [Control flow and the modern switch](README.md)
