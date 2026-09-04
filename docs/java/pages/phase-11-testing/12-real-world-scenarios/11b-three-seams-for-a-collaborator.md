---
title: "Three of the four things that make a class untestable are the same question wearing different clothes — where does this object come from — and each has a smallest move that the compiler verifies and you can revert in one step"
sidebar_label: "11b · Three seams for a collaborator"
sidebar_position: 48
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Mockito 5.23.0** javadoc §48 *static mocking* and §13
> *spying* ([site.mockito.org](https://site.mockito.org/javadoc/current/org/mockito/Mockito.html)).
> The refactoring vocabulary — *seam*, *extract and override call*, *parameterize
> constructor* — is Michael Feathers', from *Working Effectively with Legacy Code* (2004),
> paraphrased rather than quoted.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring
> Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output.

**[11](11-the-legacy-class-with-no-seams.md) established the order of operations: characterize
first, then cut. This chunk is the cutting. A *seam* is a place where you can change what the
program does without editing at that place — and three of the four missing seams are the same
question in different disguises: where does this collaborator come from? A static call, a
`new` inside a method and a constructor that does work each have a smallest move, and in every
case it is one commit, mechanical, and checked by the compiler.**

## Seam 1 · A static call in the middle of a method

```java
public Money priceFor(Order order) {
    Rate rate = RateLookup.current(order.currency());       // static, network-backed
    LocalDate today = LocalDate.now();                       // static, wall clock
    …
}
```

**Smallest move — extract and override call.** Wrap each static call in a
package-private (or `protected`) instance method, change nothing else, and the class becomes
testable through a subclass:

```java
public class LegacyPricingEngine {

    public Money priceFor(Order order) {
        Rate rate = currentRate(order.currency());
        LocalDate today = today();
        …
    }

    // seams — behaviour identical, one line each
    Rate currentRate(String currency) { return RateLookup.current(currency); }
    LocalDate today()                 { return LocalDate.now(); }
}
```

```java
class TestablePricingEngine extends LegacyPricingEngine {
    Rate rate = Rate.of("GBP", 1.0);
    LocalDate date = LocalDate.parse("2026-03-15");
    @Override Rate currentRate(String c) { return rate; }
    @Override LocalDate today()          { return date; }
}
```

This is a two-line, compiler-verified change with no behavioural risk, and it is available
even when you cannot change the constructor because forty callers use it.

**Next move, once tests exist:** replace the overridable methods with injected collaborators —
a `RateGateway` interface and a `java.time.Clock`. That is the real fix
([02b](02b-when-the-collaborator-is-hard-to-mock.md)), and the subclass seam is scaffolding
you delete on the way.

**The no-edit option** is Mockito's `mockStatic`, and [02b](02b-when-the-collaborator-is-hard-to-mock.md)
already costed it: the mock applies *"within the current thread and a user-defined scope"*, so
work handed to an executor sees the real static, and the inline mock maker's agent
attachment is its own tax. It is the right call when you genuinely may not edit the file —
a vendor jar, a code freeze — and the wrong default, because it leaves production with no
seam at all.

## Seam 2 · `new` inside the method

```java
public Receipt send(Order order) {
    SmtpClient client = new SmtpClient(host, port);   // opens a socket
    …
}
```

**Smallest move — extract a factory method** and override it, exactly as above:

```java
SmtpClient newClient() { return new SmtpClient(host, port); }
```

**Next move — parameterize the method or the constructor** so the client arrives from outside.
Prefer the constructor: a method parameter added for testing shows up at every call site and
tends to get a default that quietly re-hides the dependency.

⚠️ Do not reach for `mockConstruction` as the first answer.
[02c](02c-construction-and-final-classes.md) covers what it does and what it costs; the
short version is that it intercepts *every* construction of that type within its scope,
which is a much larger blast radius than the one line you were trying to control.

## Seam 3 · A constructor that does work

```java
public LegacyReportBuilder(String configPath) {
    this.config = ConfigParser.parse(new File(configPath));   // filesystem
    this.db = DriverManager.getConnection(config.jdbcUrl());  // network
    this.templates = loadTemplates();                          // filesystem
}
```

You cannot construct it in a test, so nothing about the class is reachable.

**Smallest move — parameterize constructor.** Add a second constructor that takes the
collaborators, and make the original delegate to it. Every existing caller compiles
untouched, and the test has a way in:

```java
public LegacyReportBuilder(String configPath) {
    this(ConfigParser.parse(new File(configPath)),
         DriverManager.getConnection(ConfigParser.parse(new File(configPath)).jdbcUrl()),
         null);
}

// the seam
LegacyReportBuilder(Config config, Connection db, TemplateStore templates) {
    this.config = config;
    this.db = db;
    this.templates = templates != null ? templates : loadTemplates();
}
```

That intermediate form is genuinely ugly — the original constructor now parses the config
twice — and that is acceptable for one commit, because it is behaviour-preserving and
reversible. Clean it up after the tests exist, not before.

**Next move:** delete the file-path constructor entirely and let the composition root
(Spring, or `main`) do the wiring. At that point the class has an ordinary constructor and the
rest of this topic applies to it normally.

## Where this connects

- The fourth seam — configuration read at class-initialisation — and the fifth answer, which
  is not to touch the class at all:
  [11c · Class-init config and the fifth answer](11c-class-init-config-and-the-fifth-answer.md).
- Characterization tests, which must exist before any move on this page:
  [11 · The legacy class with no seams](11-the-legacy-class-with-no-seams.md).
- `mockStatic`'s thread confinement and the agent tax:
  [02b · When the collaborator is hard to mock](02b-when-the-collaborator-is-hard-to-mock.md).
- `mockConstruction`, final classes and why construction is the hard case:
  [02c · Construction and final classes](02c-construction-and-final-classes.md).
- The injected `Clock` that seam 1 ends at:
  [01b · The JS-to-Java map](01b-the-js-to-java-map.md).
- Wrapping a fat vendor client in an interface you own — the same move at a larger scale:
  [04 · A third-party SDK](04-a-third-party-sdk.md).
- The mock-at-a-boundary-you-own rule these seams are all creating:
  [01 · What to mock and what to let run](01-what-to-mock-and-what-to-let-run.md).

## Gotchas

**★ An overridable seam method must not be `private`, `final`, or on a `final` class.**
Extract-and-override needs the method to be visible and overridable from the test subclass. `private` fails in a particularly nasty way: the compiler will not let the subclass override it, so the subclass gets a *new* method with the same name and the original is still called. That produces a test that appears to stub the collaborator and does not — green, and proving nothing.

**★ Extract-and-override leaves the class testable only through a hand-written subclass, which is a seam with a shelf life.**
It is scaffolding, not a design. Left in place, `newClient()` and `today()` become de facto extension points that someone eventually overrides in production code, and the class now has two ways of obtaining its collaborators. Plan the follow-up commit that turns them into constructor parameters, and do it while the characterization tests are still fresh.

**★ Parameterize-constructor's intermediate form often duplicates work, and that is fine for exactly one commit.**
Delegating the old constructor to the new one frequently means parsing config or opening a connection twice. It is behaviour-preserving, which is the property that matters at that moment, and it looks like bad code to a reviewer who does not know why. Say so in the commit message.

**★ Adding a test-only parameter to a public method leaks the seam to every call site.**
Forty callers now pass `null` or a default, and the dependency is hidden again behind that default — with the added downside that the method's signature now advertises an implementation detail. Constructor injection keeps the seam in one place; method parameters spread it.

**★ A test subclass that overrides more than the seam method has stopped testing the production class.**
The temptation, once the subclass exists, is to override the awkward method too — the one that hits the database, the one with the loop you did not want to set up. At that point the class under test is the subclass, and the production code path is only partly exercised. Override the seams and nothing else; if a second method needs overriding, it is a second seam and it deserves its own commit and its own justification.

**★ `mockStatic` is thread-confined, which makes it silently wrong for anything that hands work to an executor.**
The javadoc scopes the mock *"within the current thread and a user-defined scope"*. Legacy code that submits to a thread pool, uses a parallel stream, or goes through an `@Async` proxy sees the real static, and the test fails with the unmocked value while the arrangement reads correctly. [02b](02b-when-the-collaborator-is-hard-to-mock.md) has the full cost.

**★ `mockConstruction` intercepts every construction of the type in scope, not the one line you meant.**
If the method under test constructs three of them, or a collaborator constructs one incidentally, all of them are mocked. The blast radius is the type, not the call site, which is much wider than the problem you were solving.

**★ The "smallest move" is only safe if it is genuinely the only thing in the commit.**
Extract-and-override plus a rename plus a tidied import plus the actual fix is not a compiler-verified structural change any more; it is a change of unknown scope. The entire safety argument for these moves rests on their being mechanical and alone.

## Interview questions

**★ A method calls a static that hits the network. You cannot change the constructor because forty callers use it. What is your move?**
Extract and override. I wrap the static call in a package-private instance method that does nothing but make the call, change nothing else, and commit that alone — it is two lines, the compiler verifies it, and it cannot alter behaviour. The test then subclasses the production class and overrides that one method, which gives me control of the collaborator without touching a single caller. That is the *smallest* move; it is not the destination. Once characterization tests exist and I am no longer working without a net, the follow-up commit replaces the overridable method with an injected gateway interface, because a hand-written test subclass is scaffolding and left in place it turns into an accidental extension point. The alternative people reach for first is `mockStatic`, and I would treat that as the option for code I am not allowed to edit — it is thread-confined, which breaks the moment the method hands work to an executor, and it leaves production with no seam at all.

**★ What exactly is a "seam", and why is the word useful?**
A seam is a place where you can change what the program does without editing at that place. The word is useful because it separates two things people conflate: the *point of behaviour* and the *point of control*. A static call has no seam — the only way to change what it does is to edit the line — whereas a call to an instance method on an injected collaborator has one, because the test controls which object arrives. Framing legacy work as "find or create a seam" also gives you a much better sense of the size of the job than "refactor this class" does: you are looking for the minimum edit that separates control from behaviour, which for the common cases is one extracted method or one extra constructor. And it explains why some code is untestable in a way no amount of cleverness fixes — a `static final` constant is inlined by the compiler, so there is no runtime point of control to create, and the only seam available is the source file.

**★ Why prefer a structural change the compiler checks over a mocking trick that needs no edit?**
Because the mocking trick leaves production exactly as untestable as it was, and pays for that with a runtime mechanism that has its own failure modes — thread confinement for `mockStatic`, a type-wide blast radius for `mockConstruction`, an agent attachment for the inline mock maker. A one-line extracted method, by contrast, is verified by the compiler, reverts in one step, and leaves the codebase measurably better: the next person who has to test that class finds a seam already there. The case where I would choose the trick is when I genuinely may not edit the file — a vendor jar, a code freeze, a class owned by another team mid-release — and in that case I would say explicitly that it is a workaround with a ticket behind it, not the design.

**★ You have created a test subclass to override two seam methods. What is the exit plan?**
Delete it. The subclass is scaffolding that exists because the constructor could not be changed yet, and every day it stays it becomes more load-bearing — someone adds a third override, then a fourth, and eventually the class under test bears little resemblance to the production one. The exit is a follow-up commit that turns each overridden method into a constructor parameter: a `RateGateway` instead of `currentRate`, a `java.time.Clock` instead of `today()`. The characterization tests I wrote first are what makes that follow-up safe, and doing it while they are fresh matters, because the whole benefit evaporates if the refactor happens six months later when nobody remembers what the pinned values meant. If the follow-up genuinely cannot happen — the callers belong to another team, say — then I would at least make the seam methods package-private rather than `protected`, so they do not become part of the class's advertised extension surface.

{/* FOOTER */}
