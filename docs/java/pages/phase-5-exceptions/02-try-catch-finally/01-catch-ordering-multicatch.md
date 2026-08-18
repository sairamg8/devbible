---
title: "Catch clauses, ordering and multi-catch"
sidebar_label: "1 · Catch and multi-catch"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.20 (The `try` statement — catch
> clause selection), §11.2.2 (exception analysis), and the Java SE
> documentation on multi-catch introduced with Project Coin (JDK 7),
> behaviour re-checked against the JDK 25 compiler's documented rules.

**A `catch` chain is evaluated top to bottom against the *runtime* class of
the exception, and exactly one clause runs. The compiler polices the chain
with the subtype relation: a clause that can never be reached — because an
earlier clause already catches everything it could — is a compile error,
not a warning. Multi-catch extends the same machinery: one clause, several
unrelated types, a parameter typed as their sharpest common supertype and
locked `final` so the proof stays sound.**

## Clause selection

```java
try {
    process(order);                       // throws IOException, SQLException
} catch (FileNotFoundException e) {       // most specific first
    return retryWithDefaults(order);
} catch (IOException e) {                 // broader after
    throw new OrderIoException(order.id(), e);
} catch (SQLException e) {
    throw new OrderRepositoryException(order.id(), e);
}
```

The rules, precisely:

- The first clause whose parameter type is a supertype (or the type) of the
  thrown exception's **runtime class** wins. No fall-through: one clause
  runs, the rest are skipped.
- **Subtype-first is mandatory.** Reversing the first two clauses above is
  the compile error `exception FileNotFoundException has already been
  caught` — the `IOException` clause makes the narrower one unreachable.
  This is the exception system's version of dead-code detection.
- If no clause matches, the exception continues up — after `finally` runs
  ([chunk 2](02-finally-the-fine-print.md)).
- An exception thrown *inside a catch block* is not caught by later clauses
  of the same `try` — it propagates (subject to `finally`). Clauses guard
  the `try` block only.
- A catch parameter is an ordinary local variable: reassigning it is legal
  (and terrible style) — unless the clause is a multi-catch, where it is
  implicitly `final`.

**Ordering is subtype-driven, not specificity-driven in general:** two
unrelated types (`IOException`, `SQLException`) can appear in any order;
only sub/supertype pairs are constrained. House style still orders
most-specific-first for readability.

## Multi-catch

```java
try {
    migrate(record);
} catch (IOException | SQLException e) {   // one clause, one body
    throw new MigrationException(record.id(), e);
}
```

What the compiler does with `A | B`:

- **The parameter's static type is the least upper bound** of the
  alternatives — for `IOException | SQLException` that is `Exception`
  (their sharpest common supertype). Inside the body, `e.getMessage()` and
  everything on the LUB is available; members specific to one alternative
  need an `instanceof` test.
- **`e` is implicitly `final`.** Reassignment is a compile error. The
  reason is the *rethrow* analysis: because `e` can only hold what the
  alternatives permit, `throw e;` is checked against `IOException,
  SQLException` — not against the LUB `Exception`
  ([chunk 3](03-rethrow-and-control-flow.md) generalizes this).
- **Alternatives must be unrelated**: `IOException |
  FileNotFoundException` is a compile error ("alternatives ... are related
  by subclassing") — the subtype adds nothing the supertype doesn't cover.
- **Bytecode-wise** the body is shared, not duplicated — one handler block
  with two entries in the exception table. Multi-catch is *strictly*
  better than the copy-pasted bodies it replaced.

When *not* to multi-catch: the moment the handling diverges. A shared
body that starts with `if (e instanceof SQLException)` should have stayed
two clauses — the syntax exists to deduplicate *identical* handling, and
the translate-to-domain pattern (topic 04) is its natural customer.

## What the compiler knows about the `try` body

Catch clauses for checked types are themselves checked against the body:
a clause catching a checked exception the body **cannot** throw is a
compile error (`exception X is never thrown in body of corresponding try
statement`). Three consequences worth having ready:

- Refactoring the body (the throwing call moves elsewhere) can turn an
  existing catch clause into a compile error — the error is *good news*,
  pointing at a handler with nothing left to handle.
- `catch (Exception e)` and `catch (Throwable t)` are always permitted —
  unchecked subtypes might always fly. This is also why blanket catches
  rot silently: the compiler can never prove them dead.
- The rule applies per checked type: `catch (IOException | SQLException
  e)` needs *each* alternative throwable from the body.

## Gotchas

**Symptom:** `exception FileNotFoundException has already been caught` after someone "tidied" the catch order
**Cause:** a broader clause (`IOException`) moved above its subtype — the narrow clause became unreachable
**Fix:** subtype-first, always; treat the compile error as the ordering linter it is

**Symptom:** in a multi-catch body, `e.getErrorCode()` doesn't compile though "e is a SQLException here"
**Cause:** the parameter's static type is the least upper bound (`Exception`), not whichever alternative flew
**Fix:** split the clause if handling diverges; or `instanceof` pattern-match (`if (e instanceof SQLException sql)`) for the one divergent line

**Symptom:** `cannot assign a value to final variable e` in a multi-catch block
**Cause:** multi-catch parameters are implicitly final — required for the precise-rethrow proof
**Fix:** don't reassign catch parameters at all; bind a new local if you must transform

**Symptom:** `IOException | FileNotFoundException` rejected by the compiler
**Cause:** multi-catch alternatives must not be related by subclassing
**Fix:** keep only the supertype — it already covers the subtype

**Symptom:** an exception thrown while *handling* (inside a catch block) escapes, though "there's a catch clause for it right below"
**Cause:** catch clauses guard the `try` block, not each other
**Fix:** if handler code can itself fail, wrap that code in its own `try` — the nested-`try` translation shape of [chunk 3](03-rethrow-and-control-flow.md)

**Symptom:** `exception SQLException is never thrown in body of corresponding try statement` after a refactor
**Cause:** the call that threw it moved; the clause now handles nothing
**Fix:** delete the clause — and audit where the call moved *to*, which now needs the handling

**Symptom:** generic helper `<E extends Exception> void run(...)` won't compile with `catch (E e)`
**Cause:** a catch parameter must name a class type — type variables are not allowed (erasure leaves nothing to match against at runtime)
**Fix:** catch a concrete supertype (`Exception`) and filter with a `Class<E>` token (`if (clazz.isInstance(e))`), rethrowing what doesn't match

## Interview questions

**★ How is the catch clause chosen, and at what time?**
Top to bottom at run time, first clause whose type is the thrown
exception's class or a supertype of it; exactly one runs. But the *chain's
shape* is validated at compile time: a clause unreachable because an
earlier one subsumes it is an error, and a checked-type clause the body
can't throw is an error.

**★ What is the static type of `e` in `catch (IOException | SQLException e)`, and why does it matter?**
The least upper bound of the alternatives — here `Exception`. It matters
twice: the body can only call LUB members without a cast, and yet
`throw e;` is analyzed against the *alternatives*, not the LUB — so a
method declaring `throws IOException, SQLException` accepts the rethrow
even though `e`'s static type is `Exception`.

**★ Why must the multi-catch parameter be final?**
The precise-rethrow analysis depends on `e` holding only what the
alternatives permit. If `e` could be reassigned (`e = new
Exception()`), `throw e;` could launder an arbitrary `Exception` through a
clause that promised only `IOException | SQLException`.

**★ Does multi-catch duplicate the handler bytecode per type?**
No — one shared handler block; the exception table gets one entry per
alternative pointing at it. That's the improvement over the pre-JDK-7
pattern of literally duplicated catch bodies.

**★ An exception thrown in catch clause #1 — can clause #2 catch it?**
No. Clauses guard the `try` block only. The new exception propagates
outward — through `finally` first — and needs an *enclosing* `try` if it
must be handled locally. (This is also how translation code accidentally
loses primaries — chunk 2's masking discussion.)

**★ When do you split a multi-catch back into separate clauses?**
The moment handling diverges beyond one `instanceof`-guarded line —
divergent recovery, different retry semantics, different translations.
Multi-catch encodes "these failures are indistinguishable *here*"; keep it
truthful.

---

← Index: [`try`/`catch`/`finally` mechanics](README.md) · Next → [`finally` — the guarantees and the fine print](02-finally-the-fine-print.md)
