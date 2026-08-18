---
title: "Checked exceptions — the mechanics and the debate"
sidebar_label: "2 · Checked — mechanics and debate"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §11.2 (Compile-Time Checking of
> Exceptions) and §8.4.8.3 (overriding and `throws`), the JDK 25 Javadoc for
> `IOException` and `UncheckedIOException`, and the Kotlin language
> documentation's stated rationale for omitting checked exceptions.

**Catch-or-declare is a type rule: a checked exception is part of a method's
signature the same way its parameters are, and the compiler proves along
every call path that someone either handles it or admits it upward. That is
a genuinely strong guarantee — and forty years of collective experience
split over whether the guarantee is worth what it does to interfaces,
lambdas and layering. Know both halves; the interviewer is checking for the
debate, not a verdict.**

## The mechanics, precisely

A checked exception thrown in a method body must be either caught inside
the method or listed in its `throws` clause (JLS §11.2):

```java
// declare it upward…
List<String> read(Path p) throws IOException {
    return Files.readAllLines(p);
}
// …or handle it here
List<String> readOrEmpty(Path p) {
    try {
        return Files.readAllLines(p);
    } catch (IOException e) {
        return List.of();
    }
}
```

The details that carry the interview questions:

- **The check is per *static* type.** `throw (Exception) new
  RuntimeException()` requires handling `Exception` — the compiler reasons
  about declared types, not runtime classes.
- **`throws` clauses on overrides can only narrow** (JLS §8.4.8.3): an
  override may declare *fewer* or *more specific* checked exceptions than
  the overridden method, never new ones. Callers dispatch through the
  supertype's signature, so widening would break the proof. Consequence:
  an interface that declares no checked exceptions (`Runnable`, `Function`)
  can never gain implementations that throw them honestly — the root of
  [the lambda fight](../../phase-4-lambdas-streams/01-lambdas-functional-interfaces/03-composition-checked-exceptions.md).
- **Constructors participate**: `throws` on a constructor forces every
  `new` into a try or a declaring method — one reason "constructors that do
  I/O" is an anti-pattern.
- **`catch` of a checked type the body cannot throw is a compile error**
  ("exception X is never thrown in body of corresponding try") — except for
  `Exception` and `Throwable`, which are always allowed because unchecked
  subtypes might fly.
- **Declaring an unchecked exception is legal and purely documentary** —
  `throws IllegalArgumentException` compiles, forces nothing on callers,
  and serves only as signature-level documentation (Javadoc `@throws` does
  the same job with more room).

## Where checked exceptions earn their keep

The honest pro case, mostly per Bloch (*Effective Java*, 3rd ed., items
70–71) and the JDK's own usage:

- **Recoverable conditions at I/O boundaries.** A missing file, a dropped
  connection, a full disk: the *immediate* caller often has a real
  alternative (retry, fall back, report precisely). `IOException` at the
  edge of the filesystem API is the canonical justified checked exception.
- **The compiler-verified checklist.** In a narrow, stable API — a parser
  returning `ParseException`, a protocol library — the `throws` clause is
  machine-checked documentation that survives refactors: add a new failure
  mode and every caller *fails to compile* until it decides.
- **They make failure impossible to ignore silently** — the failure-blind
  caller must at least write the swallowing catch block, which reviews can
  then catch.

## Where they collapse

- **Interfaces and higher-order code.** `Function`, `Runnable`, `Iterator`
  declare no checked exceptions, so any implementation that meets one must
  wrap or smuggle. Streams made this a daily cost —
  `Files.lines(p).map(this::parse)` fights you the moment `parse` declares
  anything (topic 06 of this phase owns the patterns).
- **Layer contamination.** A `throws SQLException` on a repository method
  leaks vendor plumbing into service signatures; five layers up, `main`
  declares database exceptions it cannot do anything about. The fix —
  translate at the boundary (topic 04) — is exactly a conversion *to
  unchecked* or to a domain checked type, and doing it everywhere is the
  tax.
- **The swallow reflex.** Forced handling produces
  `catch (Exception e) {}` from developers under deadline — worse than no
  checking, because now the failure is *silenced*, not just undeclared.
- **Versioning stiffness.** `throws` is part of the binary contract;
  adding a checked exception to an existing method breaks every caller at
  compile time — so maintainers either version the interface or lie
  (throw an unchecked wrapper anyway).

**Why Kotlin and C# dropped them:** both languages cite the same field
evidence — the checked model's benefits didn't survive contact with large
codebases. Kotlin's documentation points at empty catch blocks as the
dominant outcome and at the interface-evolution problem; C#'s designers
(Hejlsberg's much-quoted rationale) argued versioning and scalability:
small programs enjoy the proof, large systems drown in declarations that
callers can't act on. Java itself has not added a checked exception to a
*new* core API in years — `java.util.function`, streams, `HttpClient`
(whose `send` still throws `IOException` — the boundary case proving the
rule: it really is I/O).

## The state of the debate, fairly

The positions have converged more than the flame wars suggest:

| Condition | Modern consensus |
|---|---|
| Programming bug (null, bad index, bad state) | Unchecked, always — fix the code |
| Environmental failure the immediate caller can act on | Checked is defensible (`IOException` at the I/O edge) |
| Environmental failure crossing layers | Translate at the boundary; unchecked (or a domain type) above it |
| Failure as a *value* the caller should branch on | Not an exception at all — `Optional`, a result/sealed type ([phase 2's ADTs](../../phase-2-classes-objects/09-sealed-adts.md)); topic 07 draws this line |

What remains genuinely contested is only the middle row — how far
"the caller can act on it" extends before translation should take over.
That is a judgement about *your* codebase's layering, which is why
[chunk 3](03-modern-lean-and-cost.md)'s application-code default is a
*lean*, not a law.

## Gotchas

**Symptom:** `unreported exception IOException; must be caught or declared to be thrown` — on a line that calls your own one-line helper
**Cause:** the helper declares `throws IOException`; the check propagates through every caller until someone handles it
**Fix:** decide *at this layer*: handle, declare upward, or translate (topic 04) — don't reflexively add `throws` to `main`

**Symptom:** override marked with `@Override` fails: `overridden method does not throw IOException`
**Cause:** the supertype method declares no (or narrower) checked exceptions; overrides cannot widen `throws`
**Fix:** wrap in an unchecked carrier (`UncheckedIOException`), redesign the interface to declare it, or handle it inside the override

**Symptom:** `catch (SQLException e)` is a compile error in a block that "obviously" touches the database
**Cause:** the calls in the `try` body are to an abstraction that throws a runtime `DataAccessException` — `SQLException` is never thrown there
**Fix:** catch what the body actually declares; the vendor exception was translated a layer down

**Symptom:** adding one failure mode to a published interface method breaks 40 downstream modules at compile time
**Cause:** a new checked exception in `throws` is a source-incompatible change
**Fix:** planned APIs either declare a stable checked supertype up front, use unchecked, or model failure in the return type

**Symptom:** codebase littered with `catch (Exception e) { log.warn("error", e); }` that reviewers wave through
**Cause:** checked exceptions forced *some* handling; log-and-continue was the path of least resistance
**Fix:** the handling bar is "what does the *user* of this operation experience next?" — rethrow translated, fail the operation visibly, or genuinely recover; log-and-continue is a decision, not a default

**Symptom:** team argues checked-vs-unchecked per method, inconsistently, forever
**Cause:** no codebase-level policy, so each author re-runs the debate
**Fix:** write the policy down once (typical: unchecked in application code, translation at boundaries, checked only where the JDK forces it); topic 04 is the implementation guide

**Symptom:** `initializer must be able to complete normally` / unreported-exception error on a checked-throwing call moved into a `static { }` block
**Cause:** a static initializer has no signature, so there is nowhere to declare a checked exception — catch-or-declare degenerates to catch-only (JLS §11.2.3)
**Fix:** catch inside the block and rethrow wrapped (`ExceptionInInitializerError` or an unchecked domain type) — or better, move fallible setup out of static init into an explicit factory/lazy holder

## Interview questions

**★ What exactly does the compiler check, and where does the proof live?**
Every statement that can throw a checked type must sit in a `try` with a
matching catch, or in a method declaring that type (or a supertype) in
`throws`. The proof composes along call chains through declared static
types — which is also why overrides can narrow but never widen `throws`:
callers hold the supertype's proof.

**★ Steelman checked exceptions in one minute, then unchecked in one minute.**
Checked: failure modes are part of the type; the compiler guarantees every
caller confronted them; perfect for recoverable I/O-edge conditions and
stable narrow APIs. Unchecked: failure handling belongs at *boundaries*,
not every frame; checked declarations contaminate layers, freeze interface
evolution, fight lambdas, and in practice breed swallowing catches; the
compiler's forced confrontation produces ritual, not thought.

**★ Why did streams make the debate acute?**
`java.util.function` interfaces declare no checked exceptions, and
overrides can't widen — so every checked-throwing method needs wrapping to
enter a pipeline. The friction pushed even checked-sympathetic codebases
toward unchecked domain exceptions, because the alternative is boilerplate
wrappers at every lambda.

**★ You add a retry to a method that calls a `throws IOException` API. Where does the catch go?**
Around the *retryable unit*, at the layer that owns the retry policy —
which is an argument for checked-at-the-edge: the immediate caller is
exactly who can retry. Above that layer, the exhausted-retries failure
should be translated into the domain's vocabulary, not re-declared as
`IOException` upward.

**★ Is `throws RuntimeException` in a signature meaningful?**
Legal, ignored by the compiler, and useful only as documentation — which
Javadoc `@throws` does better. Its presence usually signals a
misunderstanding of the checked mechanism; in review, move the information
to Javadoc.

**★ Can initializer blocks throw checked exceptions?**
Static initializers: no — there is no `throws` clause to declare on, so a
checked exception must be caught inside the block (typically rethrown
wrapped; the JVM reports later failures as `ExceptionInInitializerError`).
Instance initializers: yes, but only if *every* constructor of the class
declares that exception — the initializer's code runs inside each
constructor, so each signature must carry the proof.

**★ Is `throws` part of the method signature for overloading or dispatch?**
No. Overload resolution and override matching ignore `throws` entirely —
you cannot overload two methods differing only in their `throws` clauses,
and at the bytecode level the checked list lives in a separate `Exceptions`
attribute, not the method descriptor. `throws` constrains *compilation of
callers*, never runtime dispatch.

**★ Why can't a lambda implementing `Function` throw `IOException`, mechanically?**
`Function.apply` declares no checked exceptions; a lambda is an
implementation of that method, and implementations cannot widen `throws`.
So the body must catch, wrap ([`UncheckedIOException`](03-modern-lean-and-cost.md)),
or the code must target a custom throwing functional interface.

---

← Prev: [The tree, and what each branch means](01-the-tree.md) · Index: [The hierarchy, checked vs unchecked](README.md) · Next → [The modern lean, and what exceptions cost](03-modern-lean-and-cost.md)
