---
title: "A rollback rule written as a string matches by substring, not by type — so a rule for CustomException also fires for CustomExceptionV2"
sidebar_label: "13c · How a rule is matched"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Data Access →
> Transaction Management → Rolling back a declarative transaction*, sections
> *Rollback rules*, *Type matching*, *Exception pattern matching* and *Strongest
> matching rule wins*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)),
> and the `@Transactional` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**Spring matches a rollback rule in one of two completely different ways
depending on which attribute you used. `Class`-valued rules match by type.
String-valued rules match by *substring of the fully qualified class name*, with
no wildcards — which means a rule can fire for an exception you have never heard
of.**

## Type matching: the boring, safe one

When the rule comes from `rollbackFor` or `noRollbackFor`, the reference is
precise:

> Specifically, given a configured exception type `C`, a thrown exception of type
> `T` will be considered a match against `C` if `T` is equal to `C` or a subclass
> of `C`. This provides type safety and avoids any unintentional matches that may
> occur when using a pattern.

So `rollbackFor = IOException.class` matches `IOException`,
`FileNotFoundException`, `SocketTimeoutException` — everything below it — and
nothing else. It is exactly the rule you would guess, and there is nothing more
to learn.

That is the whole reason the javadoc calls it "the preferred way to construct a
rollback rule".

## Pattern matching: the one that will bite you

When the rule comes from `rollbackForClassName` or `noRollbackForClassName`, it
is a string, and:

> the pattern can be a fully qualified class name or a substring of a fully
> qualified class name for an exception type (which must be a subclass of
> `Throwable`), with no wildcard support at present.

Two things in that sentence matter. **Substring**, and **no wildcards**.

No wildcards means `"com.acme.*Exception"` is not a pattern — it is a literal
string that will never match anything, because no class is named with an asterisk
in it. People write it constantly. It fails silently.

Substring means the match is `thrownExceptionName.contains(pattern)`. The
reference spells out the consequence and gives the examples:

> a thrown exception is considered to be a match for a given pattern-based
> rollback rule if the name of the thrown exception contains the exception
> pattern configured for the rollback rule. For example, given a rule configured
> to match on `"com.example.CustomException"`, that rule will match against an
> exception named `com.example.CustomExceptionV2` (an exception in the same
> package as `CustomException` but with an additional suffix) or an exception
> named `com.example.CustomException$AnotherException` (an exception declared as
> a nested class in `CustomException`).

Read that again with `noRollbackForClassName` in mind. You exempt
`com.example.CustomException` from rollback because it is a benign business
outcome. Someone later adds `com.example.CustomExceptionV2` for something
serious. It is exempted too, by a rule nobody wrote, and it commits.

And it works upward as well as downward:

> You must carefully consider how specific a pattern is and whether to include
> package information (which isn't mandatory). For example, `"Exception"` will
> match nearly anything and will probably hide other rules.
> `"java.lang.Exception"` would be correct if `"Exception"` were meant to define
> a rule for all checked exceptions.

`"Exception"` as a pattern matches `java.lang.Exception`, but it also matches
`org.hibernate.HibernateException`, `MyDomainException`, and every other class
with the letters in its name — including plenty of unchecked ones. The reference
calls this out as *probably hiding other rules*, which brings us to the next
question: what happens when two rules both match.

## The strongest matching rule wins

> When the Spring Framework's transaction infrastructure catches an exception and
> consults the configured rollback rules to determine whether to mark the
> transaction for rollback, the strongest matching rule wins.

"Strongest" means most specific — the rule whose configured type or pattern sits
closest to the thrown exception in the class hierarchy, not the one written
first. The reference's own worked example, in the XML form:

```xml
<tx:advice id="txAdvice">
	<tx:attributes>
		<tx:method name="*" rollback-for="Throwable" no-rollback-for="InstrumentNotFoundException"/>
	</tx:attributes>
</tx:advice>
```

> in the case of the following configuration, any exception other than an
> `InstrumentNotFoundException` results in a rollback of the attendant
> transaction

Both rules match an `InstrumentNotFoundException`: it is a `Throwable`, and it is
itself. The `no-rollback-for` rule is the more specific of the two, so it wins.
The same configuration in annotation form:

```java
@Transactional(
    rollbackFor   = Throwable.class,
    noRollbackFor = InstrumentNotFoundException.class)
public void quote(String instrument) { ... }
```

This is the idiom for "roll back on absolutely everything except this one known
outcome", and it is worth recognising because it reads like a contradiction until
you know the resolution rule.

The important corollary: **the order in which you list the attributes carries no
meaning.** Swapping them changes nothing. If you find yourself relying on order,
you have misread the mechanism.

"Most specific" is a number, not a judgement, and the number is computed by
`RollbackRuleAttribute.getDepth`. The algorithm — including what happens when
nothing matches at all, and why a string pattern usually outranks a type rule —
is [13d · The matching algorithm](13d-the-matching-algorithm.md) and
[13e · When rules collide](13e-when-rules-collide.md).

## Choosing a pattern, if you must use one

The reference gives the guidance directly:

> With more unique exception names such as `"BaseBusinessException"` there is
> likely no need to use the fully qualified class name for the exception pattern.

The rule of thumb that follows from the substring behaviour:

| Pattern | Matches | Verdict |
|---|---|---|
| `"Exception"` | almost every exception in the JVM | never |
| `"BusinessException"` | anything containing those letters, in any package | risky unless the name is genuinely unique to you |
| `"com.acme.billing.LedgerWriteException"` | that class, its subclasses, its nested classes, and anything whose FQCN contains that string | the safest string form |
| `"com.acme.*Exception"` | nothing at all — no wildcards exist | always wrong, always silent |

Include the package. It does not eliminate the suffix problem — `…V2` still
matches — but it removes every accidental cross-package hit.

## The trade-off

Pattern rules buy you the ability to name a type you cannot reference at compile
time: an optional dependency, a class behind a module boundary, a generated
client's exception. That is a genuine need, and the `Class` form cannot serve it.

What you pay is that the rule's meaning is no longer bounded by the type system.
A rule that is correct today can start matching a new class tomorrow because
somebody chose a similar name, and nothing in the compiler, the IDE or the test
suite will notice. The cost is not paid at the moment you write the rule; it is
paid by whoever adds the class.

## Gotchas

**⚠️ A wildcard in a pattern**
**Symptom:** the rule never fires, and there is no error anywhere.
**Cause:** "no wildcard support at present" — the string is compared literally as
a substring, and no class name contains `*`.
**Fix:** use the `Class` form, or list the concrete names.

**⚠️ `"Exception"` as a pattern**
**Symptom:** rules you did write stop having any effect.
**Cause:** the reference's warning — it "will match nearly anything and will
probably hide other rules", including unchecked types you never intended to
touch, because it matches on letters not on hierarchy.
**Fix:** `"java.lang.Exception"` if you truly meant all exceptions; better,
`rollbackFor = Exception.class`.

**⚠️ A `V2` or `Ex` suffix inheriting an exemption**
**Symptom:** a serious new failure commits partial data, and the annotation on
the method does not mention it.
**Cause:** `noRollbackForClassName = "com.example.CustomException"` also matches
`com.example.CustomExceptionV2`, exactly as documented.
**Fix:** use `noRollbackFor = CustomException.class`. This is the single strongest
argument for the type-safe form, because the damage is done by a *later* change
to an unrelated file.

**⚠️ A nested exception class picking up the outer class's rule**
**Symptom:** `CustomException.AnotherException` behaves like `CustomException`
even though it is a different, unrelated type.
**Cause:** its binary name is `com.example.CustomException$AnotherException`,
which contains the pattern.
**Fix:** the type-safe form again, or a pattern that includes the `$`.

**⚠️ Listing `noRollbackFor` first and expecting it to lose**
**Symptom:** a method that should roll back does not, or vice versa.
**Cause:** resolution is by specificity, never by declaration order.
**Fix:** reason about which configured type is closest to the thrown type. If two
rules are equally specific and contradict each other, that is a configuration bug
to remove rather than a precedence question to answer.

**⚠️ Mixing `Class` rules and pattern rules on the same method**
**Symptom:** behaviour that is hard to predict from reading the annotation.
**Cause:** both sets go into the same rule list and are resolved together, but
one set is bounded by the type hierarchy and the other by string containment, so
"more specific" is being judged across two different notions of specificity.
**Fix:** pick one style per method. In practice: use `Class` rules, and reach for
patterns only for the type you genuinely cannot import.

**⚠️ Assuming a pattern matches only the exact class**
**Symptom:** a subclass rolls back when the author expected only the named type
to.
**Cause:** patterns match subclasses too — `"ServletException"` matches
`jakarta.servlet.ServletException` "and its subclasses" — on top of matching by
substring.
**Fix:** there is no "exact type only" rule in either form. If you need one, catch
the exception yourself and decide explicitly, as in
[14 · The caught exception](14-the-caught-exception.md).

## Interview questions

**★ What is the difference between how `rollbackFor` and `rollbackForClassName`
match?**
`rollbackFor` matches by type: given a configured type `C`, a thrown `T` matches
if `T` is `C` or a subclass of `C`. `rollbackForClassName` matches by string
containment against the fully qualified class name, with no wildcard support, so
a thrown exception matches "if the name of the thrown exception contains the
exception pattern". That means a pattern can match classes in other packages,
classes with a longer name, and nested classes of the named class — the
reference's own examples are `com.example.CustomExceptionV2` and
`com.example.CustomException$AnotherException` both matching a rule written for
`com.example.CustomException`.

**★ Why is `noRollbackForClassName` more dangerous than `rollbackForClassName`?**
Because the failure directions are not symmetrical. An over-broad `rollbackFor`
pattern makes something roll back that you did not intend — usually visible
straight away as a lost write, and rarely a correctness disaster. An over-broad
`noRollbackFor` pattern makes something *commit* that should have been undone,
which produces silently inconsistent data and no signal at all. And the over-broad
match typically appears later, when somebody adds a similarly named class, so
neither the review nor the tests of the original change could have caught it.

**★ What does "the strongest matching rule wins" mean in practice?**
That when several configured rules match a thrown exception, Spring uses the most
specific one — the configured type or pattern closest to the thrown exception in
the hierarchy — rather than the first one declared. The reference's example is
`rollback-for="Throwable"` combined with
`no-rollback-for="InstrumentNotFoundException"`: both match an
`InstrumentNotFoundException`, and because the second is more specific, that one
exception commits while everything else rolls back. It also means attribute
ordering in the annotation is meaningless, which is worth saying out loud because
people write the rules in an order they believe is significant.

**★ Write me an annotation meaning "roll back on everything except one business
outcome".**
`@Transactional(rollbackFor = Throwable.class, noRollbackFor = QuoteStaleException.class)`.
The broad rule covers checked exceptions, unchecked exceptions and `Error`; the
narrow rule wins for the one type by specificity. Since Framework 6.2 the
alternative is
`@EnableTransactionManagement(rollbackOn = RollbackOn.ALL_EXCEPTIONS)` globally
plus `noRollbackFor = QuoteStaleException.class` on the one method, which says
the same thing with less repetition and makes the safe behaviour the default
everywhere else.

**★ When is a pattern-based rule actually the right choice?**
When the type is not on your compile classpath — an optional dependency, a type
behind a module boundary you do not require, or a class generated at build time
whose name you know but cannot import. It is also defensible when you genuinely
want to catch a family of names across unrelated hierarchies, though that is
usually a sign the exception design is wrong. In every other case the `Class`
form is strictly better: same expressiveness, compiler-checked, and immune to
somebody adding `FooExceptionV2` next year.

**★ A team has `noRollbackForClassName = "NotFound"` on a service. What do you
tell them?**
That the rule matches any exception whose fully qualified name contains the
letters "NotFound" anywhere — their own `OrderNotFoundException`, a driver's
`ResourceNotFoundException`, a nested `NotFoundException` in a library class,
anything. All of those will now commit whatever the method wrote before failing.
The pattern has no package, no anchoring and no wildcards, so its scope is
"whatever happens to be named that way on the classpath, today and in future".
The fix is to name the concrete types with `noRollbackFor = { … }.class`, and if
the list is long enough to be annoying, that is information: it probably means
the exemption belongs to a common supertype, which is a `Class` rule too.

---

← Prev: [13b · Changing the rule](13b-changing-the-rule.md) · Index: [Spring @Transactional](README.md) · Next → [13d · The matching algorithm](13d-the-matching-algorithm.md)
