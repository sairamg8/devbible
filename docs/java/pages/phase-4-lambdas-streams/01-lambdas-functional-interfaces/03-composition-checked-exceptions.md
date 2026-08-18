---
title: "Composition and checked exceptions"
sidebar_label: "3 · Composition and checked exceptions"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for the
> `java.util.function` package (`Function#andThen`/`#compose`,
> `Predicate#and`/`#or`/`#negate`/`#not`, `Consumer#andThen`,
> `BinaryOperator#minBy`/`#maxBy`, `UnaryOperator`), `java.io.UncheckedIOException`,
> `java.util.concurrent.Callable`, and JLS SE 25 §11.2 (compile-time checking
> of exceptions) and §18 (type inference for the sneaky-throws analysis).

**The functional interfaces are not just parameter types — they are a small
algebra. `andThen`, `compose`, `and`, `or`, `negate` build new functions from
old ones without writing a lambda at all. The algebra has one missing piece,
and it is the sharpest edge in everyday lambda code: none of the
`java.util.function` interfaces declare `throws`, so a checked exception
inside a lambda is a compile error with no beautiful fix — only a set of
honest trade-offs you should choose deliberately.**

## Function composition: `andThen` and `compose`

```java
Function<Order, Customer>  customer = Order::customer;
Function<Customer, String> email    = Customer::email;

Function<Order, String> a = customer.andThen(email);   // customer, THEN email
Function<Order, String> b = email.compose(customer);   // same function
```

`f.andThen(g)` runs `f` first (`g(f(x))`); `f.compose(g)` runs `g` first
(`f(g(x))`). They are mirror spellings of the same idea, and the confusion
between them is common enough that most codebases standardize on `andThen`
only — it reads in execution order, like a pipeline. Composition is
associative, so chains just work:

```java
Function<Order, String> domain =
    customer.andThen(email).andThen(s -> s.substring(s.indexOf('@') + 1));
```

Nulls flow through composition unchecked: if `customer` returns `null`,
`email` receives it and throws NPE from *inside* the composed function — the
stack trace names the lambda, not the call site that built the chain. Guard
inside the stage that can produce `null`, or model absence with `Optional`
(**topic 07** — see the [phase index](../README.md)).

## Predicate logic: `and`, `or`, `negate`, `not`

```java
Predicate<Order> paid     = Order::isPaid;
Predicate<Order> shipped  = Order::isShipped;

Predicate<Order> refundable = paid.and(shipped.negate());
Predicate<Order> actionable = paid.or(shipped);
```

- **Short-circuit semantics match `&&`/`||`**: `and` skips the second test
  when the first is false, `or` skips it when the first is true — documented,
  and load-bearing when the second predicate is expensive or can throw.
- **`Predicate.not(...)`** (static, Java 11) exists to negate a *method
  reference*, which has no `.negate()` to call:

  ```java
  orders.stream().filter(Predicate.not(Order::isShipped))   // ✔
  // orders.stream().filter(!Order::isShipped)              // ✘ does not compile
  ```
- `BiPredicate` has `and`/`or`/`negate` too; `IntPredicate` and friends
  mirror the set for primitives.

Composed predicates are values: name them (`REFUNDABLE`), store them in
constants, pass them to `filter`, `removeIf`, `takeWhile`, `Optional.filter`
— one definition, every call site consistent.

## The rest of the vocabulary's combinators

- **`Consumer.andThen`** — run two effects in order over the same input
  (`log.andThen(persist)`). If the first consumer throws, the second never
  runs — there is no error isolation; it is plain sequencing.
- **`BinaryOperator.minBy(cmp)` / `maxBy(cmp)`** — turn a `Comparator` into
  a two-arg chooser, exactly what `reduce` and `Map.merge` want:

  ```java
  map.merge(key, order, BinaryOperator.maxBy(comparing(Order::updatedAt)));
  ```
- **`UnaryOperator` composes as `Function`.** `UnaryOperator<T>` extends
  `Function<T, T>` but `andThen`/`compose` are declared on `Function`, so
  the composed result is a `Function<T, T>`, not a `UnaryOperator<T>`:

  ```java
  UnaryOperator<String> trim  = String::strip;
  UnaryOperator<String> lower = s -> s.toLowerCase(Locale.ROOT);
  Function<String, String> both = trim.andThen(lower);   // ✔ Function
  // UnaryOperator<String> both = trim.andThen(lower);   // ✘ won't compile
  ```

  Where an API demands `UnaryOperator` (e.g. `List.replaceAll`), wrap the
  composed function in one lambda: `s -> both.apply(s)`, or compose manually.

## Why checked exceptions and lambdas fight

Every abstract method in `java.util.function` is declared without `throws`.
A lambda's body is checked against the target method's `throws` clause
(JLS §11.2), so this does not compile:

```java
List<String> paths = List.of("a.json", "b.json");
paths.stream()
     .map(p -> Files.readString(Path.of(p)))   // ✘ IOException — unhandled
     .toList();
```

This was a deliberate Java 8 design choice: generic `throws` transparency
(`Function<T, R, E extends Exception>`) was judged too heavy for the common
case, and most pipeline lambdas are pure computations. The cost lands on I/O
at the seams. There are five honest responses.

### 1. Extract a named method that handles it

```java
private static String readOrThrow(String p) {
    try {
        return Files.readString(Path.of(p));
    } catch (IOException e) {
        throw new UncheckedIOException(e);
    }
}
// ...
paths.stream().map(Chunk::readOrThrow).toList();
```

The pipeline stays clean, the handling is testable and reusable, and the
method name documents policy. **Default choice for anything non-trivial.**

### 2. try/catch inside the lambda

Same content, inline. Fine for one-offs; past three lines the lambda has
outgrown being a lambda — extract (case 1).

### 3. Wrap to unchecked — the JDK's own pattern

`UncheckedIOException` exists precisely for this: `Files.lines`,
`Files.list` and the other stream-returning I/O methods document that their
lazy stages throw it, because the `Stream` machinery between producer and
terminal op cannot pass `IOException` through. Follow the precedent: wrap
with a cause (`new UncheckedIOException(e)` /
`new IllegalStateException(e)`), never swallow, and catch the unchecked
wrapper at the pipeline's boundary if the caller can recover — the cause
chain preserves the original.

### 4. A throwing functional interface of your own

```java
@FunctionalInterface
interface ThrowingFunction<T, R, E extends Exception> {
    R apply(T t) throws E;

    static <T, R> Function<T, R> unchecked(ThrowingFunction<T, R, ?> f) {
        return t -> {
            try { return f.apply(t); }
            catch (Exception e) { throw asUnchecked(e); }
        };
    }
    @SuppressWarnings("unchecked")
    private static <E extends Exception> RuntimeException asUnchecked(Exception e) throws E {
        throw (E) e;   // erasure: E infers to RuntimeException at the call site
    }
}
// ...
paths.stream().map(ThrowingFunction.unchecked(p -> Files.readString(Path.of(p))))
```

One small adapter, written once per codebase (or taken from a utility
library), keeps call sites readable. The `asUnchecked` body is the
**sneaky-throws trick**: erasure lets a checked exception propagate without
declaration, because `E` is inferred as `RuntimeException` where the compiler
checks (JLS §18 inference plus §11.2's static-only checking — the JVM itself
never verifies `throws`). Know it to recognize it (Lombok's `@SneakyThrows`
is the same move); be wary of *hiding* it in general-purpose code, since a
checked `IOException` then flies through `catch (RuntimeException)` handlers
unseen and surprises every caller that trusted the signature.

### 5. Choose an interface that already throws

`Callable<V>` declares `throws Exception`; so do `ExecutorService.submit`'s
overloads and much of `java.util.concurrent`. When you control the seam,
accepting `Callable` (or your own throwing interface) instead of `Supplier`
moves the problem to where it can be declared honestly.

**Where each belongs:** named method for real logic (1); inline try/catch
for trivial one-offs (2); wrap-to-unchecked at stream seams, following the
`UncheckedIOException` precedent (3); a shared adapter when a codebase does
this constantly (4); a throwing interface when you design the API (5).
What is *never* right: an empty catch, or `throw new RuntimeException(e)`
scattered ad hoc with no policy.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Composed pipeline runs stages in the wrong order | `compose` runs its *argument* first; `andThen` runs the *receiver* first | Standardize on `andThen` (reads in execution order); reserve `compose` for point-free style you actually need |
| NPE deep inside a composed function, stack trace names a lambda | An earlier stage returned `null` and a later stage dereferenced it | Guard in the producing stage, or make absence explicit with `Optional` before composing |
| `!Order::isShipped` does not compile | A method reference is not a `Predicate` until target-typed; `!` needs a boolean | `Predicate.not(Order::isShipped)` |
| Second predicate's side effect sometimes doesn't happen | `and`/`or` short-circuit like `&&`/`||` | Don't put effects in predicates; if unavoidable, evaluate both explicitly first |
| `UnaryOperator<String> f = trim.andThen(lower)` won't compile | `andThen` is declared on `Function` and returns `Function<T, R>` | Accept `Function<T, T>`, or wrap: `s -> trim.andThen(lower).apply(s)` |
| `map(p -> Files.readString(...))` — "unhandled exception: IOException" | `java.util.function` methods declare no `throws`; lambda bodies are checked against the target method | Extract a handling method, or wrap to unchecked (`UncheckedIOException`) at the seam |
| `IOException` escapes a method whose signature doesn't declare it | Sneaky-throws (hand-rolled or `@SneakyThrows`) laundered it past the compiler | Treat as a code smell in shared code; catch `Exception` at boundaries you don't control |
| Stream from `Files.lines` throws after the terminal op started | Lazy I/O stages wrap failures in `UncheckedIOException` mid-pipeline, documented on the method | Catch `UncheckedIOException` around the terminal op; unwrap `getCause()` for the real error |
| First consumer in `a.andThen(b)` throws and `b` silently never runs | `Consumer.andThen` is plain sequencing, no error isolation | If both effects must be attempted, call them in separate try blocks, not via `andThen` |

## Interview questions

1. **`f.andThen(g)` vs `f.compose(g)` — difference?** `andThen`: `f` first,
   result into `g`. `compose`: `g` first, result into `f`. Same machinery,
   mirrored order; `andThen` reads like a pipeline, which is why most teams
   use only it.
2. **Why does `Predicate.not` exist when `negate()` already does?** `negate`
   needs a `Predicate` receiver; a method reference has no type until
   target-typed, so `Order::isShipped.negate()` is illegal. `not(...)`
   provides the target type and negates in one step.
3. **Do `Predicate.and`/`or` short-circuit?** Yes, with `&&`/`||` semantics,
   per the Javadoc — the second predicate isn't evaluated when the first
   settles the answer. Also: exceptions from the first propagate and skip
   the second.
4. **Why can't two `UnaryOperator`s compose into a `UnaryOperator`?**
   Composition methods live on `Function` and return `Function` — the
   `T = R` constraint that makes it a `UnaryOperator` is lost in the return
   type. It's an API-design artifact, not a type-system limit.
5. **Why don't the `java.util.function` interfaces declare `throws`?**
   Design trade-off from Java 8: exception-generic interfaces
   (`Function<T, R, E>`) infect every signature for a rare need. Purity was
   chosen for the common case; I/O seams pay with explicit adapters.
6. **What is `UncheckedIOException` and why is it precedent?** The JDK's own
   wrapper for `IOException` in lazy/stream contexts (`Files.lines`
   documents it): checked at the edge, unchecked through the pipeline, cause
   preserved. It legitimizes wrap-to-unchecked as the standard seam pattern.
7. **Explain sneaky-throws.** A generic `throws E` where `E` infers to
   `RuntimeException` lets any exception propagate undeclared — the compiler
   checks `throws` statically (JLS §11.2) and the JVM never does. Useful
   inside a well-labeled adapter; dangerous hidden in shared code, because
   checked exceptions then bypass every handler keyed to the signature.
8. **A teammate writes `catch (Exception e) {}` inside every stream lambda
   to "make it compile". Review it.** Swallowing errors turns I/O failures
   into silent wrong results. Choose a policy: named method with real
   handling, wrap-to-unchecked rethrow, or a throwing interface at the API
   seam — and let the pipeline's caller see failures.
9. **When would you accept `Callable<V>` instead of `Supplier<V>` in your
   own API?** When implementations legitimately do checked-exception work
   (I/O, interruption): `Callable.call()` declares `throws Exception`, so
   callers write natural bodies and *your* code owns the handling policy
   once, instead of every caller adapting.

---

← Prev: [The `java.util.function` vocabulary](02-the-function-vocabulary.md) · Index: [Lambdas and functional interfaces](README.md) · Next → [Method references](../02-method-references.md)
