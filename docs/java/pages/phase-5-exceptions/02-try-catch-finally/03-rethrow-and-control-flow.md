---
title: "Precise rethrow, and control flow through try"
sidebar_label: "3 · Rethrow and control flow"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §11.2.2 (the analysis of thrown
> types for effectively-final catch parameters), §14.20.2 (abrupt
> completion through `finally`), and §14.15/§14.16 (`break` and `continue`
> interacting with enclosing `try` statements).

**Two refinements complete the `try` statement's picture. Precise rethrow:
since JDK 7, `throw e;` from a catch clause is checked against what the
`try` body can *actually* throw — not against the catch parameter's
declared type — whenever the parameter is effectively final. And control
flow: `break`, `continue` and `return` don't teleport; on their way out of
a `try` they run every enclosing `finally`, which is both the guarantee
you rely on and another route into the discard semantics.**

## Precise rethrow

The pattern that motivated it — intercept everything, act, rethrow:

```java
public void sync(Path p) throws IOException, SQLException {
    try {
        pull(p);              // throws IOException
        persist(p);           // throws SQLException
    } catch (Exception e) {   // catch BROAD…
        metrics.increment("sync.failure");
        throw e;              // …rethrow NARROW: compiles against IOE, SQLE
    }
}
```

Pre-JDK-7 this forced `throws Exception` on the method — the broad catch
type contaminated the signature. The modern rule (JLS §11.2.2): if the
catch parameter `e` is **effectively final** (never assigned), the
compiler knows `e` can only hold an exception the body threw that this
clause caught and no earlier clause took. So `throw e;` is analyzed
against that precise set — here `{IOException, SQLException}` — plus any
unchecked types. The method's honest signature survives the broad
intercept.

The moving parts:

- **Effectively final is the switch.** One assignment to `e` anywhere in
  the clause (`e = new Exception()`) and the analysis falls back to the
  declared type — the rethrow now needs `throws Exception`. The error
  message when this bites points at the signature, not the assignment,
  which is why people miss it.
- **Multi-catch parameters are implicitly final** — the same analysis is
  why ([chunk 1](01-catch-ordering-multicatch.md)); `catch (IOException |
  SQLException e) { throw e; }` checks against exactly the alternatives.
- **Earlier clauses subtract.** With `catch (FileNotFoundException f)`
  above the broad clause, the broad clause's rethrow set no longer
  contains `FileNotFoundException` — the analysis models clause order.
- **Wrapping is different from rethrowing.** `throw new
  DomainException(e)` is an ordinary throw of the new type; precise
  rethrow only concerns `throw e` of the caught reference.

## `break`, `continue`, `return` — through `finally`

Abrupt exits don't skip cleanup. Every transfer out of a `try` statement
runs its `finally` (innermost outward) before control arrives:

```java
for (Path p : files) {
    try {
        if (skip(p)) continue;      // finally runs, THEN next iteration
        if (limit()) break;         // finally runs, THEN loop exits
        process(p);
        if (done(p)) return;        // finally runs, THEN method returns
    } finally {
        release(p);                 // on every path out, including the three above
    }
}
```

With labels the same holds across levels — `break outer;` from a nested
`try` runs *each* enclosing `finally` between the `break` and the labeled
statement, in inner-to-outer order. Two consequences:

- **This is why `finally`-based cleanup composes with loop logic** — you
  can `continue` out of a guarded iteration knowing the per-iteration
  release happened.
- **And why chunk 2's discard rule reaches further than it looks**: a
  `continue` *inside the `finally` block itself* of a loop's `try`
  discards a pending exception exactly as `return` did — the pending
  reason is dropped in favour of `finally`'s abrupt completion. The
  no-abrupt-statements-in-`finally` rule covers all four kinds, not just
  `return`.

## Shapes that survive review

**Cleanup + handling, disentangled.** When a method needs both, nest
deliberately rather than piling clauses on one statement:

```java
public Report run(Job job) {
    Resource r = acquire(job);          // acquisition OUTSIDE the try
    try {
        try {
            return execute(r, job);
        } catch (TransientException e) {
            return retryOnce(r, job);   // handling, close to the cause
        }
    } finally {
        release(r);                     // cleanup, on every path
    }
}
```

- Acquisition sits *before* the `try` — if `acquire` throws, there is
  nothing to release, and the `finally` must not run against an
  unassigned resource. (Try-with-resources encodes exactly this ordering
  for `AutoCloseable`s — [next topic](../03-try-with-resources/README.md).)
- Handler-in-inner, cleanup-in-outer keeps each concern's scope minimal;
  the alternative — one `try` with catch *and* finally — is fine until
  the catch block itself can throw, at which point nesting makes the
  cleanup guarantee visible instead of incidental.

**Translation with its own guard.** Chunk 1 established that a throw from
a catch clause escapes the statement; when translation code can fail
(message formatting touching a lazy proxy, a metrics call), the reviewable
shape is an inner `try` around the fallible part, not hope.

**`try`/`finally` vs try-with-resources, the decision restated:** if the
cleanup target is `AutoCloseable` and its close can throw, TWR — you get
ordering, null-safety and suppression for free. If the cleanup is a
non-throwing invariant (unlock, gauge decrement, thread-local restore),
`try`/`finally` — TWR would force an artificial `AutoCloseable` wrapper
for no semantic gain. (The wrapper *is* idiomatic when it adds a name —
`try (var ignored = tracer.span("load"))` — but that is API design, not
cleanup mechanics.)

## Gotchas

**Symptom:** `unreported exception Exception; must be caught or declared` on `throw e;` that "worked yesterday"
**Cause:** someone assigned to the catch parameter in the clause; effectively-final broke, precise rethrow reverted to the declared broad type
**Fix:** never assign catch parameters — bind transformations to new locals; the compiler error's fix is deleting the assignment, not widening `throws`

**Symptom:** after adding `catch (FileNotFoundException f)` above a broad clause, the broad clause's `throw e;` no longer satisfies a `throws FileNotFoundException` declaration elsewhere
**Cause:** precise rethrow subtracts earlier-caught types from the rethrow set — the broad clause can no longer throw FNFE
**Fix:** expected behaviour; tidy the now-unneeded declaration — the analysis is telling you the truth about flow

**Symptom:** loop's per-iteration cleanup runs "even though we `continue`d before the end"
**Cause:** not a bug — `continue` through a `try` runs `finally` first, by design
**Fix:** rely on it; if cleanup must *not* run for skipped items, the skip test belongs before the `try`

**Symptom:** exception vanishes in a loop; iteration just moves on
**Cause:** `continue` inside the `finally` block — abrupt completion of `finally` discards the pending exception (same rule as `return`)
**Fix:** no `break`/`continue`/`return`/`throw` written inside `finally`, in any surrounding construct

**Symptom:** `finally` NPEs on `r.close()` when acquisition failed
**Cause:** resource acquired *inside* the `try`, so the failure path reaches `finally` with `r` null/unassigned
**Fix:** acquire before `try` (nothing to clean if acquisition throws), or null-guard — or use try-with-resources, which handles both

**Symptom:** review debate: one `try` with catch+finally vs nested tries
**Cause:** both compile; semantics differ when the catch block can throw — flat form still runs its own `finally`, but readers routinely mis-predict it
**Fix:** flat when the catch body is throw-free and trivial; nested (handler inner, cleanup outer) the moment handling can fail — write the guarantee you mean

## Interview questions

**★ Explain how `catch (Exception e) { log(e); throw e; }` compiles in a method declaring only `throws IOException`.**
Precise rethrow: `e` is effectively final, so the compiler analyzes
`throw e` against the checked exceptions the `try` body can actually throw
and this clause can actually receive — say `{IOException}` — rather than
the declared `Exception`. Assign to `e` anywhere and this collapses to the
declared type.

**★ What exactly makes the precise-rethrow analysis sound?**
Effective finality. Because `e` cannot be reassigned, its value at
`throw e` must be an exception object that (a) the body threw, (b) matches
this clause, (c) no earlier clause caught. The compiler can therefore
bound its runtime type by that set. Any assignment invalidates (a)–(c).

**★ `return` in a `try` inside a loop inside another `try` — what runs, in what order?**
The return operand is evaluated; then the inner `try`'s `finally`, then the
outer `try`'s `finally` (inner to outer), then the method completes with
the captured value — unless any `finally` completes abruptly, whose reason
then replaces the return.

**★ Why does try-with-resources acquire resources in the header rather than the body?**
Same reason manual code acquires before `try`: a failed acquisition must
not trigger cleanup of the thing that was never acquired. The header
formalizes acquire-then-guard ordering per resource, closing only those
successfully initialized — with multiple resources, a mid-list failure
closes the earlier ones and not the failed one.

**★ When is `try`/`finally` still the right tool in post-JDK-7 code?**
Non-`AutoCloseable`, non-throwing cleanup: `lock.unlock()`,
`ThreadLocal.remove()`, counters, restoring context. Wrapping those in
synthetic `AutoCloseable`s adds allocation and indirection to gain
suppression machinery their can't-fail cleanup will never use — unless the
wrapper earns its place as a named scope (`try (var span = ...)`).

**★ A labeled `break outer;` crosses three nested `try` statements. Which `finally` blocks run?**
All three between the `break` and the labeled statement, innermost first.
Any of them completing abruptly hijacks the transfer (the `break` is
discarded in favour of the new reason) — one more reason `finally` bodies
stay abrupt-free.

---

← Prev: [`finally` — the guarantees and the fine print](02-finally-the-fine-print.md) · Index: [`try`/`catch`/`finally` mechanics](README.md) · Next → [try-with-resources](../03-try-with-resources/README.md)
