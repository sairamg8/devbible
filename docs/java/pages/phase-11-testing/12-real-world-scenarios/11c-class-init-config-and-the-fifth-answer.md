---
title: "The fourth seam is the only one where the problem is time rather than provenance — a class initialises once per class loader and may have read its configuration before your test existed — and past it lies the fifth answer, which is to leave the class alone and put the new behaviour beside it"
sidebar_label: "11c · Class-init config and the fifth answer"
sidebar_position: 72
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Java Language Specification, Java SE 25** §12.4.1
> *When Initialization Occurs*
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html)) and
> §13.1 on constant variables
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se25/html/jls-13.html)).
> The refactoring vocabulary — *sprout method*, *sprout class* — is Michael Feathers', from
> *Working Effectively with Legacy Code* (2004), paraphrased rather than quoted.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[11b](11b-three-seams-for-a-collaborator.md) dealt with three seams that are all the same
question: where does this object come from. This chunk is the fourth, which is a different
question — *when was this value read* — and it is the only one of the four with a case that is
genuinely impossible rather than merely awkward. It closes with the option nobody offers in
interviews: not cutting at all.**

## Seam 4 · Configuration read at class-initialisation

The nastiest of the four, because the JVM's rules mean the read may have happened before your
test's first line.

```java
public class LegacyGateway {
    private static final String ENDPOINT = System.getProperty("gateway.url");
    private static final int TIMEOUT = Integer.parseInt(System.getProperty("gateway.timeout"));
}
```

Two JLS facts decide what is possible.

**Initialisation happens once, on first active use.** §12.4.1:

> *"A class or interface `T` will be initialized immediately before the first occurrence of
> any one of the following: `T` is a class and an instance of `T` is created. A static method
> declared by `T` is invoked. A static field declared by `T` is assigned. A static field
> declared by `T` is used and the field is not a constant variable."*

and

> *"A class or interface will not be initialized under any other circumstance."*

Once per class loader, and build tools run many test classes in one JVM. So a test that sets
`gateway.url` in `@BeforeEach` and then touches `LegacyGateway` is setting the property
*after* some earlier test in the same fork already triggered `<clinit>`. The test passes when
run alone and fails when run with the suite, or the reverse — the classic "works in the IDE"
report.

**A `static final` initialised with a compile-time constant is not read at all.** §13.1:

> *"A reference to a field that is a constant variable (§4.12.4) must be resolved at compile
> time to the value V denoted by the constant variable's initializer."*

> *"If such a field is `static`, then no reference to the field should be present in the code
> in a binary file, including the class or interface which declared the field."*

So `private static final String ENDPOINT = "https://prod.example.com";` is *inlined into every
call site at compile time*. No amount of reflection, agent trickery or property setting can
change it, because at runtime the field is not consulted. (The `System.getProperty` version
above is *not* a constant variable — a method call is not a constant expression — so it is
read at `<clinit>`, once.)

**Smallest move — make the read lazy and instance-scoped**, which is a change the compiler
checks:

```java
public class LegacyGateway {
    private final String endpoint;
    private final Duration timeout;

    public LegacyGateway() {                       // preserves every existing caller
        this(System.getProperty("gateway.url"),
             Duration.ofMillis(Long.parseLong(System.getProperty("gateway.timeout"))));
    }

    LegacyGateway(String endpoint, Duration timeout) {   // the seam
        this.endpoint = endpoint;
        this.timeout = timeout;
    }
}
```

The static read still exists for production, but it now happens per instance, at a moment the
test controls, and there is a constructor that bypasses it entirely.

**What does not work, and is tried first by everyone:** `@TestPropertySource`,
`@DynamicPropertySource` and `application-test.yml` all populate Spring's `Environment`. This
code never asks Spring anything; it asks `System`. Spring will happily set the property in its
own property sources and the static read will not see it.

**The last resort, priced honestly:** configuring the build to fork a fresh JVM per test class
does give each class a clean class-init. It also multiplies JVM startup across the suite,
which is one of the most expensive things you can do to a build. Reach for it only when the
class genuinely cannot be edited.

## 🔴 The fifth answer: do not touch the class

The most under-used option is to leave the legacy class exactly as it is and put the new
behaviour beside it.

**Sprout method** — the change is a new block of logic inside an existing method. Instead of
writing it there, write it as a new, testable method (or a new class) and call it from one
line in the legacy code:

```java
public Money priceFor(Order order) {
    …existing 200 lines, untouched…
    total = loyaltyAdjuster.apply(total, order);   // ← the only new line
    return total;
}
```

`LoyaltyAdjuster` is new code with proper constructor injection and full unit tests. The
legacy method has one added line, which is about as small as a change to untested code can
be. **Sprout class** is the same move when the new logic needs its own state.

Take this route when:

- the class is scheduled for deletion or replacement, and any investment in it is written off;
- you do not own the class and a structural change would collide with another team;
- the change is genuinely additive, so the existing behaviour does not need to be understood;
- you could not get a characterization test at any affordable level, which means a refactor
  would be unverified — and an unverified refactor of untested code is the single riskiest
  thing on this page.

The cost is honest: the legacy class stays untestable and the codebase now has two places
where pricing logic lives. Write that down in the ticket. "We sprouted rather than refactored
because X" is a decision; silently sprouting forever is how a class reaches 900 lines.

## Where this connects

- The three collaborator seams and the smallest move for each:
  [11b · Three seams for a collaborator](11b-three-seams-for-a-collaborator.md).
- Characterization tests, which must exist before any move on either page:
  [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md).
- Pinning wide legacy output as a golden master:
  [10b · Volatile fields and the review workflow](10b-volatile-fields-and-the-review-workflow.md).
- The mock-at-a-boundary-you-own rule the sprouted class gets for free:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).
- Builders that make constructing legacy inputs bearable: **topic 08**,
  [../08-test-data-patterns/README.md](../08-test-data-patterns/README.md).

## Gotchas

**★ `private static final String X = "literal"` is inlined at compile time and cannot be changed at runtime by anything.**
The JLS requires that *"a reference to a field that is a constant variable … must be resolved at compile time to the value V"* and that for a static one *"no reference to the field should be present in the code in a binary file"*. Reflection that sets the field appears to succeed and changes nothing, because no call site reads it. This is why "just set it with reflection" advice sometimes works (non-constant initialisers) and sometimes silently does not (constant ones), which is far worse than failing outright.

**★ A test that sets a system property before touching a class assumes `<clinit>` has not already run.**
It has, if any earlier test in the same JVM fork touched the class. §12.4.1 makes initialisation a once-per-loader event triggered by first active use, and build tools reuse forks by default. The symptom is a test that passes alone and fails in the suite, or passes in whatever order the IDE happened to pick — and the natural response, adding `@DirtiesContext` or reordering tests, does not address it, because it is a class-loader-level fact and not a Spring one.

**★ `@TestPropertySource` cannot influence code that calls `System.getProperty` directly.**
Spring's property sources are Spring's. Legacy code that reads `System` bypasses the entire mechanism, so the property appears set in `Environment`, the test looks correctly configured, and the class still uses whatever the JVM was started with. The fix is to route the read through an injected value, not to add more Spring annotations.

**★ Setting a system property in a test and not restoring it leaks into every test that runs afterwards in the same fork.**
Even when the property *is* read lazily, `System.setProperty` is global mutable state for the lifetime of the JVM. A test that sets `gateway.url` and does not clear it in an `@AfterEach` changes the behaviour of unrelated tests, and the resulting failure appears in a class that never mentions the property.

**★ A static field that caches a value on first use has the same problem as `<clinit>` with none of the visibility.**
`if (cached == null) cached = System.getProperty(...)` looks lazy and testable, and it is — exactly once. The second test in the same fork gets the first test's value. It is harder to spot than a static initialiser because the code reads as if it re-evaluates.

**★ Forking a JVM per test class fixes class-init isolation and can double or triple suite runtime.**
It is a real lever and close to the most expensive one available, because JVM startup and JIT warm-up are paid per fork. Use it for one tagged group of genuinely un-editable classes if you must; applying it to the whole suite to solve one class's problem is a trade nobody would make consciously.

**★ Sprouting forever is how the 900-line class got to 900 lines.**
Every individual decision to add one line and put the logic elsewhere is defensible. The aggregate is a class nobody has ever refactored and a codebase where the behaviour is split across two places with no explanation. Record the reason in the ticket so the next person can tell a deliberate strategy from an accumulated avoidance.

**★ Refactoring without a characterization test at *any* level is more dangerous than making the change directly.**
A refactor touches more lines than the change would have. If nothing is pinned, you have taken on more risk in order to reduce risk. When no affordable pin exists — the behaviour is not observable, the environment cannot be reproduced — the correct answer is a sprout plus monitoring, not a brave refactor.

**★ A sprouted class that reads the legacy class's mutable state is not actually separated.**
The point of sprouting is that the new code is independently testable. If `LoyaltyAdjuster` takes the legacy object and pulls four fields off it, it has inherited the legacy class's setup problem and gains nothing. Pass values, not the object, and the sprouted class stays a plain unit with plain tests.

## Interview questions

**★ A class reads `System.getProperty` in a static initialiser. Why is that so much worse than reading it in a constructor, and what do you do?**
Because of when it happens and how often. The JLS says a class is initialised *"immediately before the first occurrence"* of an active use and *"will not be initialized under any other circumstance"* — once per class loader. Build tools reuse a JVM across many test classes, so by the time my test sets the property, some earlier test has almost certainly already triggered `<clinit>` and the value is fixed for the rest of the run. That produces the worst kind of failure: passes alone, fails in the suite, or vice versa depending on ordering. It is also immune to `@TestPropertySource`, because the code asks `System`, not Spring. My move is to make the read instance-scoped: keep a no-arg constructor that does the `System.getProperty` for existing callers, and add a package-private constructor taking the values, which is the seam. And if the field happens to be `static final` with a literal initialiser, I would point out that it is a constant variable and the JLS requires it to be *"resolved at compile time"* with no reference present in the bytecode — so reflection cannot change it either, and the only route is to change the source.

**★ When would you *not* refactor a legacy class you have been asked to change?**
Several cases, and I would want to name them explicitly rather than treat refactoring as always-correct. If the class is scheduled for replacement, investment in it is written off. If I do not own it and a structural change collides with another team's work in flight, the coordination cost exceeds the benefit. If the change is purely additive, so the existing behaviour never has to be understood, a sprout method — new tested class, one call added to the legacy method — is a smaller change than any refactor. And the decisive one: if I could not obtain a characterization test at any affordable level, then a refactor touches more lines than the change itself while being entirely unverified, which is strictly more risk taken on in the name of reducing risk. In that case I make the smallest possible change, add monitoring around it, and write the reason in the ticket. What I would not do is sprout by default, because the class in front of me got to 900 lines by a long series of individually defensible decisions to not touch it.

**★ Which of the four seam problems is the hardest and why?**
Configuration read at class-initialisation, comfortably, because it is the only one where the problem is partly outside your program's control flow. The other three are all about where an object comes from, and all three have a mechanical, compiler-verified fix available in one commit. Class-init is about *time*: the JLS makes initialisation a once-per-class-loader event triggered by first active use, so in a suite that shares a JVM the read may have happened before your test existed, and no arrangement inside the test can undo it. It also has a sub-case that is genuinely impossible rather than merely awkward — a `static final` with a constant initialiser, which the spec requires the compiler to inline with *"no reference to the field … present in the code in a binary file"*. And it is the one where the obvious tools mislead you: `@TestPropertySource` sets a property, the test looks correctly configured, and the class never asked Spring in the first place.

**★ Sell me the sprout method. Why is adding a second place for the logic ever the right call?**
Because the alternative is not "clean code" — it is an unverified structural change to a class nobody understands. A sprout is one added line in the legacy method plus a new class with proper constructor injection and a full set of fast unit tests. That is about the smallest possible change to untested code, and the new behaviour is better tested than anything else in the file. The cost is real and I would state it: the pricing logic now lives in two places, and the legacy class is exactly as untestable as it was. So the sprout is right when the class is on its way out, when I do not own it, when the change is additive so the old behaviour never needs understanding, or when I genuinely could not get a characterization test at any level. It is wrong as a habit, and the way to tell the difference is whether the reason is written down. A ticket that says "sprouted because this class is being replaced in Q3" is a strategy; five sprouts with no explanation is how the class got this big.

{/* FOOTER */}
