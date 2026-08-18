---
title: "var — local-variable type inference"
sidebar_label: "03 · var"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against JEP 286 (Local-Variable Type Inference, 10),
> JEP 323 (var for lambda parameters, 11), the JLS SE 25 §14.4, and the
> OpenJDK "Local Variable Type Inference: Style Guidelines".

**`var` asks the compiler to write the type it already knows. It is pure
compile-time inference — the variable is exactly as statically typed as
before, the bytecode is identical, and nothing "dynamic" happened. The
entire skill is editorial: `var` improves the line when the type is obvious
from the right-hand side, and degrades it when the reader now has to infer
what the compiler inferred.**

## Where `var` is legal — and only there

```java
var order = repository.findById(id);          // local with initializer
for (var item : order.items()) { ... }        // enhanced for
for (var i = 0; i < n; i++) { ... }           // classic for
try (var in = Files.newInputStream(path)) {}  // try-with-resources
```

Not legal: fields, method parameters, return types, `catch` parameters, a
declaration without an initializer, an initializer of `null` (no type to
infer), or an array initializer shorthand (`var a = {1, 2}` — no type
either). One deliberate extra from JEP 323: **lambda parameters** may use
`var` (`(var a, var b) -> ...`), existing solely so annotations can be
attached to them — all-or-none across the parameter list.

`var` is also a *reserved type name*, not a keyword — old code with `var`
variables still compiles; a class named `var` does not.

## The inference is exact — which is the point and the trap

The inferred type is the initializer's *static* type, precisely:

- `var n = 1;` is `int` — not `long`, not `Integer`. `var n = 1L;` for a long.
- `var list = new ArrayList<>();` is **`ArrayList<Object>`** — the diamond
  has nothing to infer *from* on the left, so it collapses to `Object`, and
  every later `add` of your actual type still compiles while every read
  gives `Object`. Spell the type parameter: `var list = new ArrayList<Order>();`
- `var result = service.process(x);` is whatever `process` declares — change
  that return type in a refactor and every `var` call-site *silently
  re-infers*. Compiles-or-breaks is usually what you want; "compiles and
  means something different" is the case to watch in review.
- The inferred type can be **non-denotable** — something you could not write:
  an anonymous class (whose extra members become accessible through the
  `var`), an intersection type, a capture. Occasionally useful, always worth
  a second look.

`var` also infers the *concrete* type where an explicit declaration would
have chosen the interface: `var list = new ArrayList<Order>()` is
`ArrayList<Order>`, where the house style was probably `List<Order>`. That
pins implementation details into the variable's type — usually harmless for
a local, but it is a real difference, not a spelling one.

## The editorial rules (the OpenJDK style guide, condensed)

Use `var` when the initializer *names the type*:

```java
var users = new ArrayList<User>();
var mapper = new ObjectMapper();
var response = new OrderResponse(order.id(), order.total());
```

Avoid `var` when the reader would have to open another file to know the
type — chained calls, unfamiliar factory methods, and especially when the
name doesn't help:

```java
var result = service.execute(request);   // what IS result?
var x = getData();                       // twice as bad
```

Middle ground the guide endorses: let good *names* carry the load
(`var orderCount = countOrders(...)`), and prefer `var` in short scopes
where the variable's whole life is visible on one screen. Ten lines of
scope forgive what two hundred lines don't.

## Gotchas

**Symptom:** a `var` list accepts your objects but `get` returns `Object`
**Cause:** `var list = new ArrayList<>()` — diamond with no left-hand target type infers `ArrayList<Object>`
**Fix:** put the type argument on the right: `new ArrayList<Order>()`. With `var`, the right-hand side is the single source of type truth

**Symptom:** integer `var` overflows or boxes unexpectedly
**Cause:** `var n = 1` is `int` — not the `long` (or `Integer`) an explicit declaration would have chosen
**Fix:** suffix the literal (`1L`) or don't use `var` where the width matters (money, ids)

**Symptom:** a refactor changed a method's return type and call-sites "still compile" but behave differently
**Cause:** every `var` call-site silently re-inferred to the new type (e.g., `List` → `Collection`, or a widened numeric type)
**Fix:** rely on the compiler for incompatible changes (they still fail loudly); for compatible-but-meaningful ones, IDE find-usages on the refactored method — `var` moved the information, not removed the obligation

**Symptom:** code accesses a method that "doesn't exist" on any named type
**Cause:** `var` captured an anonymous class's non-denotable type, exposing its extra members
**Fix:** fine as a local trick; if the value escapes the method, give it a named type or interface — non-denotable types can't appear in signatures anyway

**Symptom:** `var` declaration rejected: "cannot infer type"
**Cause:** no initializer, `null` initializer, or array-literal shorthand — nothing to infer from
**Fix:** initialize at declaration with a typed expression, or declare the type explicitly. (`var x = (String) null;` compiles and is a smell, not a fix)

**Symptom:** review friction — half the team writes `var`, half explicit types, diffs churn
**Cause:** no shared line on when inference helps
**Fix:** adopt the OpenJDK style guide's rule as written policy: `var` only where the initializer (or an unambiguous name) makes the type obvious at the call-site

## Interview questions

**★ Is `var` dynamic typing?**
No. The compiler infers the static type from the initializer at compile
time; the variable's type is fixed forever and the bytecode is identical to
an explicit declaration. It is exactly `int`/`ArrayList<Order>`/etc. — just
unspelled.

**★ Where is `var` allowed?**
Locals with initializers, both `for` forms, try-with-resources — and lambda
parameters (11+, for annotations, all-or-none). Not fields, not parameters,
not return types, not without an initializer, not with a bare `null`.

**★ What does `var list = new ArrayList<>();` infer, and why is it a trap?**
`ArrayList<Object>` — the diamond normally borrows the left-hand side's type
argument, and `var` removed it. Everything still compiles on insert; type
information is simply gone. The type argument must move to the right-hand
side.

**What is a non-denotable type, and how does `var` interact with it?**
A type inference can produce but source can't write — anonymous classes,
intersections, captures. `var` can hold one (making an anonymous class's
extra members callable); explicit declarations can't. Keep such variables
method-local.

**Why might a team ban `var result = service.execute(req);` but allow `var users = new ArrayList<User>();`?**
The style-guide line: inference is for the *reader*, not the writer. In the
second, the type is on the line; in the first, the reader must know
`execute`'s signature — the declaration stopped carrying information exactly
where it was needed most.

**Did `var` change Java's runtime or performance model in any way?**
None — no reflection, no boxing, no indirection. It is a purely syntactic
feature of `javac` (topic on what `javac` does: almost everything here,
nothing at run time).

---

← Prev: [Autoboxing and the integer cache](02-autoboxing-integer-cache/README.md) · Next → [Operators, division and overflow](04-operators-overflow.md)
