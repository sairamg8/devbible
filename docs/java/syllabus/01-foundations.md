---
title: "Part 1 — Foundations"
sidebar_label: "1 · Foundations"
sidebar_position: 1
---

> Phases 0–2 · The platform, the language core, and objects done properly

This is the part that separates "writes Java" from "understands Java". Most of
what bites people in production — boxing surprises, `equals` contracts, mutable
state leaking across layers — is decided here, before any framework appears.

---

## Phase 0 — The platform and the JVM

The mental model everything else hangs off. Java is not "slow C++" and not
"verbose JavaScript" — it is a managed runtime with a compiler in the loop at
run time, and that changes how you reason about performance and deployment.

| Topic | Tier |
|---|---|
| What Java is: source → `javac` → **bytecode** → JVM. Why "write once, run anywhere" actually holds — the `.jar` you build on a Mac runs unchanged on the Linux server | <span className="db-tier t-master">Master</span> |
| **JDK vs JRE vs JVM**, and distributions: Temurin, Oracle, Corretto, Zulu — same bytecode, different support contracts. Which one your Docker base image is, and why it matters at CVE time | <span className="db-tier t-understand">Understand</span> |
| Release model: one major every **6 months**, **LTS every 2 years** (17 → 21 → 25). Build on the LTS; read the feature releases. Why "we're on Java 8" is a real sentence you will hear in interviews | <span className="db-tier t-understand">Understand</span> |
| Running code: `java`, `javac`, single-file source launch (`java Hello.java`), multi-file source programs, `jshell` for trying an API in ten seconds | <span className="db-tier t-master">Master</span> |
| **Packages and the classpath** — how the JVM finds a class, `ClassNotFoundException` vs `NoClassDefFoundError`, and why "it works in the IDE" fails on the server | <span className="db-tier t-master">Master</span> |
| `main`, JVM startup, program arguments, **system properties (`-D`) vs environment variables** — the two config channels every deploy script uses | <span className="db-tier t-master">Master</span> |
| **JIT compilation**: interpreter → C1 → C2, warmup — why the first 100 requests after a deploy are slower than the next 100,000 | <span className="db-tier t-know">Know</span> |
| Garbage collection, the working model: you allocate, the JVM reclaims — and what that costs. (Tuning and algorithms are Phase 12) | <span className="db-tier t-understand">Understand</span> |
| Version managers: **SDKMAN!**, `.sdkmanrc`, IDE/toolchain pinning — the team stays on one JDK on purpose | <span className="db-tier t-understand">Understand</span> |
| The standard library layout: `java.base`, `java.util`, `java.time` — where things live, and reading the Javadoc as a first reflex | <span className="db-tier t-know">Know</span> |
| The **module system (JPMS)**: `module-info.java`, why most applications stay on the classpath, and where modules still reach you (`jlink`, `--add-opens` errors from frameworks) | <span className="db-tier t-know">Know</span> |
| Java vs Kotlin vs the JVM ecosystem — honest comparison, and why Java itself closed most of the gap (records, `var`, pattern matching) | <span className="db-tier t-know">Know</span> |
| HotSpot internals: tiered compilation details, deoptimization, intrinsics | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain what happens between typing
`java -jar app.jar` and the first request being served — load, verify, interpret,
JIT — and why restarting a Java service always costs you warm-up time.

---

## Phase 1 — Language core

The syntax is the easy half. The tier-Master rows here are the ones that produce
production bugs when half-known: boxing, `==` on strings, `BigDecimal`.

| Topic | Tier |
|---|---|
| **Primitives vs reference types** — the 8 primitives, stack vs heap, default values, why a `long` field and a `Long` field behave differently when unset | <span className="db-tier t-master">Master</span> |
| **Autoboxing and the integer cache**: `Integer a = 127; Integer b = 127; a == b` is `true` — and `false` at 128. The classic "works in the test, fails with real IDs" bug | <span className="db-tier t-master">Master</span> |
| `var` — local-variable type inference: where it helps, where it hides the type a reviewer needs | <span className="db-tier t-master">Master</span> |
| Operators: integer division and overflow (silent wraparound — no exception), `%` with negatives, bit operations, `Math.addExact` when overflow must be an error | <span className="db-tier t-master">Master</span> |
| Floating point: why `0.1 + 0.2 != 0.3` here too, `float` vs `double`, and **`BigDecimal` for money — always, with `String` constructor and explicit scale** | <span className="db-tier t-master">Master</span> |
| **Strings**: immutability, the string pool, `==` vs `equals` — the interview question that is also a real bug — `StringBuilder` in loops, `String.format`/`formatted` | <span className="db-tier t-master">Master</span> |
| **Text blocks** (`"""`) — SQL and JSON in tests without escape soup | <span className="db-tier t-understand">Understand</span> |
| Control flow, and the modern **`switch` expression** with arrows, `yield`, and exhaustiveness — the readable replacement for `if`/`else` chains over enums | <span className="db-tier t-master">Master</span> |
| Arrays: fixed size, covariance (and the `ArrayStoreException` it invites), `Arrays.toString` — why collections replace them in application code | <span className="db-tier t-master">Master</span> |
| Methods: overloading resolution (which one runs when you pass `null`?), varargs, pass-by-value — Java copies references, it never passes them | <span className="db-tier t-master">Master</span> |
| `static` — class-level state and methods, why static mutable state is the enemy of tests and of thread-safety | <span className="db-tier t-master">Master</span> |
| `final` on variables, parameters, methods, classes — what each actually prevents (hint: not deep immutability) | <span className="db-tier t-understand">Understand</span> |
| **`null` and `NullPointerException`** — helpful NPE messages (since 14) that name the exact null, defensive patterns at boundaries, `Objects.requireNonNull` with a message | <span className="db-tier t-master">Master</span> |
| Casting and **`instanceof` pattern matching** (`if (o instanceof User u)`) — the checked-cast idiom that deleted a decade of boilerplate | <span className="db-tier t-master">Master</span> |
| Naming and idiom: conventions the ecosystem actually enforces — `camelCase`, constants, package naming, one public type per file | <span className="db-tier t-understand">Understand</span> |
| Operator precedence and expression evaluation order — read it, don't rely on it; parenthesize | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can say, without running it, what
`Integer.valueOf(1000) == Integer.valueOf(1000)`, `"a" + "b" == "ab"` and
`0.1 + 0.2 == 0.3` each print — and why the fix for each is different.

---

## Phase 2 — Classes and objects, done properly

Java is object-oriented with no escape hatch — every line you ship lives in a
class. This phase is the difference between classes that model the domain and
classes that are bags of getters.

| Topic | Tier |
|---|---|
| Class anatomy: fields, constructors, `this`, initialization order (field initializers → constructor), constructor chaining with `this(...)` | <span className="db-tier t-master">Master</span> |
| **Encapsulation and access modifiers**: `private`/package-private/`protected`/`public` — package-private as the underrated default for internals | <span className="db-tier t-master">Master</span> |
| Inheritance: `extends`, `super`, overriding, `@Override` as a compile-time safety net — and why deep hierarchies rot | <span className="db-tier t-master">Master</span> |
| **Polymorphism and dynamic dispatch** — the mechanism every framework you will use is built on | <span className="db-tier t-master">Master</span> |
| Abstract classes vs **interfaces** — choosing by "is-a with shared state" vs "can-do contract"; interfaces with `default`, `static` and `private` methods | <span className="db-tier t-master">Master</span> |
| **`equals`/`hashCode` — the contract**: symmetric, consistent, and paired. The bug where an entity "disappears" from a `HashSet` because a field mutated after insertion | <span className="db-tier t-master">Master</span> |
| `toString` — for logs, not for parsing; what a good one includes (no secrets, no lazy-loaded graphs) | <span className="db-tier t-understand">Understand</span> |
| **Records** — the default for data carriers: components, compact constructors for validation, generated `equals`/`hashCode`, where records replace DTO classes wholesale | <span className="db-tier t-master">Master</span> |
| **Sealed interfaces + records + `switch` = algebraic data types**: modelling `PaymentResult` as `Approved \| Declined \| Failed` with compiler-checked exhaustiveness | <span className="db-tier t-understand">Understand</span> |
| **Enums** — with fields, methods and per-constant behaviour: order status machines, strategy tables; `values()`, `valueOf` and its exception | <span className="db-tier t-master">Master</span> |
| Nested classes: static nested vs inner (and the outer-instance reference inner classes secretly hold — a classic memory-leak shape), anonymous classes, local classes | <span className="db-tier t-understand">Understand</span> |
| **Designing immutable classes**: final fields, defensive copies of mutable inputs (`List.copyOf`), no leaked `this` — why immutable objects make Phase 6 (concurrency) mostly free | <span className="db-tier t-master">Master</span> |
| Composition over inheritance — delegating instead of extending, and the `extends ArrayList` mistake that locks your API to someone else's | <span className="db-tier t-understand">Understand</span> |
| Object lifecycle: allocation, reachability, no destructors — `Cleaner` exists, finalization is gone; resource cleanup belongs to try-with-resources (Phase 5) | <span className="db-tier t-know">Know</span> |
| The rest of `Object`: `clone` (broken by design — copy constructors instead), `getClass`, `wait`/`notify` (legacy — Phase 6) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** model a small order domain — `Order`, `OrderStatus`
enum, sealed `PaymentResult`, an immutable `Money` record over `BigDecimal` —
where invalid states don't compile and `equals` behaves in a `HashSet`.

---

← Index: [Java](../README.md) · Next → [Part 2 — The core library](02-core-library.md)
