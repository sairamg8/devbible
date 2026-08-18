---
title: "Syntax, capture and this"
sidebar_label: "1 · Syntax, capture and this"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.27 (lambda expressions),
> §15.27.2 (lambda bodies, effectively final), §4.12.4 (final variables),
> and the `java.lang.invoke.LambdaMetafactory` Javadoc (JDK 25).

**A lambda has no type of its own. The compiler reads the type from the
*target* — the parameter, variable, or return the lambda is assigned into —
finds that interface's single abstract method, and checks the lambda against
that method's signature. Everything else in this chunk (capture rules,
`this`-binding, compilation strategy) follows from lambdas being
*expressions typed by context*, not objects you construct.**

## Every syntax form

```java
// full form: parameter types, parentheses, block body, return
BiFunction<Integer, Integer, Integer> add = (Integer a, Integer b) -> { return a + b; };

// inferred parameter types (the normal form)
BiFunction<Integer, Integer, Integer> add2 = (a, b) -> a + b;

// one inferred parameter: parentheses optional
Predicate<String> blank = s -> s.isBlank();

// zero parameters: parentheses required
Supplier<List<String>> fresh = () -> new ArrayList<>();

// var parameters — all-or-nothing, mainly to attach annotations
BiFunction<String, String, String> j = (@NonNull var a, var b) -> a + b;

// expression body vs block body
Function<Integer, Integer> sq  = n -> n * n;          // expression: value IS the result
Function<Integer, Integer> sq2 = n -> { return n * n; }; // block: needs explicit return
```

Rules the compiler holds you to:

- **Mixing forms is illegal**: `(String a, b) -> …` and `(var a, String b) -> …`
  don't compile — parameter styles are all-explicit, all-inferred, or all-`var`.
- An expression body that is a statement expression (`s -> list.add(s)`) can
  target both a `Consumer<String>` (result discarded) and a
  `Predicate<String>` (the `boolean` return used) — the *target* decides.
- A block body with a value-returning path must return on **every** path.

## Target typing — the part that explains the error messages

A lambda is only valid where the compiler can find a functional interface
target: assignment, method argument, return, cast, ternary branches.

```java
Object o = () -> "hi";                       // ✗ Object is not functional
Object o2 = (Supplier<String>) () -> "hi";   // ✓ cast supplies the target
var f = () -> "hi";                          // ✗ var needs a type to infer FROM
```

The same text means different things against different targets:

```java
Callable<String> c = () -> read();   // may throw checked exceptions
Supplier<String> s = () -> read();   // ✗ if read() throws IOException
```

Overload resolution uses the lambda's *shape* (arity, void vs value) to pick
the method — which is why an overload set taking both `Consumer` and
`Function` can make a one-line lambda ambiguous
(**phase 1's overloading topic**: [Methods](../../phase-1-language-core/10-methods.md)).

## Capture: effectively final, and why

```java
int total = 0;
orders.forEach(o -> total += o.amount());   // ✗ compile error
```

A lambda may use local variables of the enclosing method only if they are
**effectively final** — never reassigned after initialization (JLS
§15.27.2). The lambda captures the *value*, not the variable: the local
lives on the stack and may be gone (method returned, thread changed) by the
time the lambda runs, so Java copies it and refuses to let two copies drift
apart silently.

- **Fields are not captured — they are accessed live** through `this` or
  the class. A lambda reading a mutable field sees its *current* value each
  invocation. That is a feature and a race hazard (phase 6).
- The classic workarounds for the accumulator itch are all wrong except the
  last: a one-element array (`int[] total`), an `AtomicInteger` — or
  **restructure into a reduction**: `orders.stream().mapToInt(Order::amount).sum()`.
- Loop variables of an enhanced-`for` are effectively final *per iteration*
  — capturing them is fine. The classic `for (int i…)` index is not.

## `this` — the sharpest difference from anonymous classes

```java
class Handler {
    Runnable lambda    = () -> System.out.println(this);   // the Handler
    Runnable anonymous = new Runnable() {
        public void run() { System.out.println(this); }    // the Runnable
    };
}
```

Inside a lambda, `this` (and unqualified method calls) mean the **enclosing
instance** — a lambda introduces no scope of its own, no shadowing, no new
`this`. An anonymous class introduces all three. Consequences:

- A lambda in an instance context **captures `this`** the moment it uses a
  field or instance method — which keeps the whole enclosing object
  reachable. A long-lived lambda (listener, cache loader, scheduled task)
  holding `this` is the same leak shape as phase 2's inner classes
  ([Nested classes](../../phase-2-classes-objects/11-nested-classes.md)).
- A lambda in a `static` context has no `this` to capture — a static
  method reference or a lambda calling only its parameters is
  **non-capturing**, and the runtime may reuse a single instance for it.
- You cannot shadow: `s -> …` won't compile if `s` is already a local in
  scope — unlike an anonymous class parameter.

## How lambdas compile — enough to read a stack trace

A lambda does **not** compile to an inner class file. The body becomes a
private synthetic method (`lambda$main$0`), and the lambda expression
becomes an `invokedynamic` instruction that bootstraps through
`LambdaMetafactory` at first execution to spin the implementing object
(JLS/JVM division of labour; `LambdaMetafactory` Javadoc). What you should
actually retain:

- Stack traces show frames like `MyClass.lambda$process$1(MyClass.java:42)`
  — that *is* your lambda body, with a real line number. Read it normally.
- **Identity is unspecified**: two evaluations of the same lambda may or
  may not return the same object. Never use a lambda as a map key, never
  compare listeners by `==` to deregister them — store the reference you
  registered.
- A lambda's class is generated at runtime (`MyClass$$Lambda/0x…`) — it
  will not be in your JAR, which occasionally surprises reflection- and
  agent-based tooling.
- Serialization requires an explicit `Serializable` cast target and is
  discouraged by the Javadoc itself; treat lambdas as non-serializable.

## Gotchas

**Symptom:** "local variables referenced from a lambda expression must be final or effectively final"
**Cause:** the lambda reads a local that is reassigned somewhere in the method — even *after* the lambda
**Fix:** restructure into a stream reduction, hoist into a new effectively-final local (`final var snapshot = value;`), or make it a field if it is genuinely state

**Symptom:** counter/accumulator inside `forEach` compiles (via `AtomicInteger` or array cell) but produces wrong totals under parallel streams
**Cause:** capture was legal but the mutation is shared across threads
**Fix:** express it as `reduce`/`sum`/`collect` — the terminal ops exist precisely so state never escapes into captured variables

**Symptom:** `this` inside the lambda is "the wrong object" after converting an anonymous class
**Cause:** anonymous `this` was the anonymous instance; lambda `this` is the enclosing instance — the conversion silently changed meaning
**Fix:** name the outer explicitly where needed; if the code relied on the anonymous instance's own state, a lambda is the wrong tool — keep the class

**Symptom:** memory profile shows an activity/service retained by a scheduled task or listener
**Cause:** the lambda uses one field, which captures the whole `this`
**Fix:** copy the needed value into a local first (`var id = this.id; () -> log(id)`) — captures the value, not the object

**Symptom:** `var f = () -> …` refuses to compile
**Cause:** `var` infers from the initializer, and a lambda has no standalone type — two inferences with no anchor
**Fix:** write the functional interface type explicitly on the left

**Symptom:** lambda compiles against one overload of a library method, and an "ambiguous method call" appears after adding a seemingly unrelated overload
**Cause:** overload resolution can only use the lambda's shape; two functional targets with the same shape tie
**Fix:** cast the lambda to the intended interface, or extract it into a typed variable

**Symptom:** removing a listener with an "identical" lambda doesn't remove it
**Cause:** each lambda evaluation may create a distinct object; `equals` is identity
**Fix:** store the registered instance in a field and pass that same reference to the remove call

**Symptom:** checked exception "unhandled" inside a lambda that is one line long
**Cause:** the target interface's method declares no `throws`; the lambda must satisfy *its* signature, not the enclosing method's
**Fix:** chunk 3's patterns — wrap, sneak, or choose a throwing interface (`Callable`)

## Interview questions

**★ Why must captured locals be effectively final, when fields need not be?**
Locals live in a stack frame that can die before the lambda runs, so the
lambda captures a copy of the value; allowing reassignment would let the
original and the copy diverge invisibly. Fields are reached live through
the captured `this` reference, so there is one location and no divergence
— just ordinary (and thread-unsafe) shared state.

**★ What does `this` mean inside a lambda, and why is that different from an anonymous class?**
The enclosing instance — a lambda is lexically transparent, adding no scope
and no identity of its own. An anonymous class is a real class, so its
`this` is the new instance. This is the one semantic change that makes
"convert to lambda" refactorings not always behaviour-preserving.

**★ Is a lambda always a new object?**
Unspecified, deliberately. The metafactory may return a shared instance for
non-capturing lambdas and must create per-evaluation instances when values
are captured. Code is correct only if it never depends on lambda identity
— no `==`, no map keys, no dedup.

**★ Why does the same lambda text compile as a `Callable` but not as a `Supplier`?**
The lambda is checked against the target's single abstract method.
`Callable.call` declares `throws Exception`; `Supplier.get` declares
nothing — so a body throwing a checked exception fits one target and not
the other. The lambda has no meaning until a target gives it one.

**★ How does a lambda differ from an anonymous class in compiled form?**
No inner-class file: a synthetic private method holds the body and an
`invokedynamic` call site links it through `LambdaMetafactory` on first
use. Practical effects: cheaper class-file footprint, runtime-generated
class names in traces, and no guaranteed identity.

**How do you fix "must be effectively final" without an array hack?**
Prefer restating the loop as a reduction so the accumulator disappears;
otherwise introduce a final snapshot variable per value needed. The
one-element array compiles but institutionalizes shared mutable state —
it is the bug from the parallel-streams topic waiting to happen.

**Can a lambda shadow a local variable?**
No — lambda parameters share the enclosing scope, so `s -> …` fails to
compile when `s` already names a local. Anonymous-class parameters, having
their own scope, can shadow. Another reason conversions are not mechanical.

---

← Index: [Lambdas and functional interfaces](README.md) · Next → [The `java.util.function` vocabulary](02-the-function-vocabulary.md)
