---
title: "Explicit rollback rules ADD to the default rather than replacing it — the twenty lines of Spring source that decide every rollback answer people get wrong"
sidebar_label: "13d · The matching algorithm"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `RuleBasedTransactionAttribute`,
> `RollbackRuleAttribute`, `DefaultTransactionAttribute` and
> `SpringTransactionAnnotationParser` sources
> ([github.com/spring-projects/spring-framework/.../transaction/interceptor/RuleBasedTransactionAttribute.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/interceptor/RuleBasedTransactionAttribute.java)),
> the `RollbackRuleAttribute` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/RollbackRuleAttribute.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/RollbackRuleAttribute.html))
> and the Spring Framework 7.0 reference *Rolling back a declarative transaction*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0.

**[Chunk 13c](13c-how-a-rule-is-matched.md) covered how one rule matches one
exception. This chunk is the code that turns those matches into a yes or a no, and
it is short enough to hold in your head — which is worth doing, because the most
confidently repeated claim about `@Transactional` is wrong and this is where you
can see it. **Explicit rollback rules do not replace Spring's default; they add to
it.** Everything else follows from one `if` nobody reads.
[Chunk 13e](13e-when-rules-collide.md) takes the same algorithm to the case where
two rules both match at once.**

## The whole decision, in one method

`RuleBasedTransactionAttribute.rollbackOn`:

```java
@Override
public boolean rollbackOn(Throwable ex) {
    RollbackRuleAttribute winner = null;
    int deepest = Integer.MAX_VALUE;

    if (this.rollbackRules != null) {
        for (RollbackRuleAttribute rule : this.rollbackRules) {
            int depth = rule.getDepth(ex);
            if (depth >= 0 && depth < deepest) {
                deepest = depth;
                winner = rule;
            }
        }
    }

    // User superclass behavior (rollback on unchecked) if no rule matches.
    if (winner == null) {
        return super.rollbackOn(ex);
    }

    return !(winner instanceof NoRollbackRuleAttribute);
}
```

Three steps. Score every rule. Keep the lowest score above zero. If nothing
scored, ask the superclass.

⚠️ **The local variable is called `deepest` and holds the *shallowest* depth
seen.** It is a misleading name in Spring's own source, and it is the reason
people repeat "the deepest match wins". The javadoc has it right: *"a rule with a
lower matching depth wins."*

## The score: `getDepth`

```java
private int getDepth(Class<?> exceptionType, int depth) {
    if (this.exceptionType != null) {
        if (this.exceptionType.equals(exceptionType)) {
            return depth;
        }
    }
    else if (exceptionType.getName().contains(this.exceptionPattern)) {
        return depth;
    }
    if (exceptionType == Throwable.class) {
        return -1;
    }
    return getDepth(exceptionType.getSuperclass(), depth + 1);
}
```

It starts at the thrown exception's own class and walks up to `Throwable`,
counting. The javadoc states the meaning:

> *"`-1` means this rule does not match the supplied exception. `0` means this rule
> matches the supplied exception directly. Any other positive value means this
> rule matches the supplied exception within the superclass hierarchy, where the
> value is the number of levels in the class hierarchy between the supplied
> exception and the exception against which this rule matches directly."*

Note the asymmetry between the two branches. A **type** rule compares with
`equals` at each level — exact class identity, checked once per ancestor. A
**pattern** rule asks whether that level's name *contains* the string.

## The branch nobody reads — rules add to the default

The `winner == null` branch is the one nobody reads, and it is the answer to the
most common rollback question there is.

`DefaultTransactionAttribute.rollbackOn` is one line:

```java
return (ex instanceof RuntimeException || ex instanceof Error);
```

So if you write:

```java
@Transactional(rollbackFor = InsufficientStockException.class)   // a checked exception
public void placeOrder(NewOrder cmd) throws InsufficientStockException { ... }
```

…and the method throws an `IllegalStateException` instead, no configured rule
matches it — `getDepth` walks `IllegalStateException` → `RuntimeException` →
`Exception` → `Throwable` without ever `equals`-ing `InsufficientStockException`
— so `winner` is `null`, the superclass is consulted, and it rolls back. **Adding
a rollback rule for one type does not switch off the default for every other
type.** The class javadoc says the same thing in one sentence: *"If no custom
rollback rules apply, this attribute behaves like `DefaultTransactionAttribute`
(rolling back on runtime exceptions)."*

🔴 **The same branch is why `rollbackFor = RuntimeException.class` is a no-op.**
A thrown `Error` matches that rule at depth `-1` — `Error` is not a
`RuntimeException`, and the walk reaches `Throwable` without a hit — so `winner`
is `null` and the default rolls it back regardless. The widely repeated claim
that the explicit form "narrows the default by dropping `Error`" is wrong, and it
is wrong for a reason worth knowing rather than a detail worth memorising.

## The trade-off

Knowing this algorithm buys you the ability to answer rollback questions from
first principles instead of from folklore, and the folklore in this area is
unusually bad — "explicit rules replace the default", "the deepest match wins" and
"`rollbackFor = RuntimeException.class` drops `Error`" are all repeated
confidently and all wrong. **What it costs is that you are now reasoning about
implementation rather than contract.** The fallback to the superclass is not
promised in so many words by the reference; the *documented* statements are the
class javadoc's "if no custom rollback rules apply, this attribute behaves like
`DefaultTransactionAttribute`" and the `RollbackRuleAttribute` javadoc's "a rule
with a lower matching depth wins". Read the source to understand, and design
against the documented behaviour — which in practice means never relying on a rule
to switch something *off* that the default would have rolled back, unless that
rule is a `noRollbackFor`.

## Gotchas

**⚠️ Believing `rollbackFor` replaces the default**
**Symptom:** an argument in review about whether adding a rule for a checked
exception "turns off" rollback for runtime exceptions.
**Cause:** it does not. Unmatched exceptions fall through to
`DefaultTransactionAttribute.rollbackOn`.
**Fix:** to genuinely exempt a type, name it in `noRollbackFor`. That is the only
attribute that can make something commit which the default would have rolled back.

**⚠️ Quoting "the deepest match wins"**
**Symptom:** a confidently wrong answer in an interview or a review.
**Cause:** Spring's local variable is named `deepest` while holding the
shallowest depth.
**Fix:** the javadoc's wording is the correct one: "a rule with a lower matching
depth wins", where `0` is a direct match.

**⚠️ Expecting `getDepth` to understand interfaces**
**Symptom:** a rule naming an interface the exception implements never matches.
**Cause:** the walk is `exceptionType.getSuperclass()` — the class hierarchy
only, terminating at `Throwable`.
**Fix:** name a class. An exception hierarchy that only shares an interface
cannot be addressed by a single type rule.

**⚠️ Reasoning about rules before establishing that the interceptor ran**
**Symptom:** careful depth analysis of a method that never had a transaction.
**Cause:** self-invocation, an unproxied bean, or a `catch` inside the method —
no exception reached the interceptor, so no rule was consulted at all.
**Fix:** confirm the boundary first ([05 · Annotations that do nothing](05-annotations-that-do-nothing.md)),
then reason about rules.

## Interview questions

**★ Do explicit rollback rules replace Spring's default, or add to it?**
They add to it. `RuleBasedTransactionAttribute.rollbackOn` scores every
configured rule against the thrown exception, and if none of them matches it
calls `super.rollbackOn(ex)` — `DefaultTransactionAttribute`, which is literally
`ex instanceof RuntimeException || ex instanceof Error`. The class javadoc puts
it as "if no custom rollback rules apply, this attribute behaves like
`DefaultTransactionAttribute`". So annotating a method with
`rollbackFor = SomeCheckedException.class` does not stop an
`IllegalStateException` rolling that method back; it only adds a type that the
default would have committed. The only way to make something commit that the
default would have rolled back is a `noRollbackFor` rule that matches it.

**★ Someone says `rollbackFor = RuntimeException.class` is narrower than the
default because it drops `Error`. Are they right?**
No, though the first half of their reasoning is sound. The default is
`RuntimeException` **or** `Error`, and an `Error` genuinely does not match a rule
configured for `RuntimeException` — `getDepth` walks `Error` up to `Throwable`
comparing classes and never finds one, so it returns `-1`. What they have missed
is what happens next: with no matching rule, `winner` is `null` and the method
falls through to the superclass behaviour, which rolls back on `Error`. The
outcome is identical to writing nothing. The real objection to the annotation is
not that it changes behaviour but that it does not: it reads like a decision, so
the next person to touch the method assumes something was decided.

**★ Why do people say "the deepest match wins" when the javadoc says the
opposite?**
Because Spring's own source misleads them. The loop variable that tracks the best
score so far is called `deepest`, and it holds the *smallest* depth seen —
`if (depth >= 0 && depth < deepest) { deepest = depth; winner = rule; }`. Anyone
reading the implementation and not the javadoc comes away with the name rather
than the semantics. The correct statement is that the shallowest rule wins, where
shallowest means closest to the thrown exception's own class, and a direct match
at depth `0` beats everything.

**★ Would a rule naming an interface the exception implements ever match?**
No. `getDepth` recurses on `exceptionType.getSuperclass()` and stops when it
reaches `Throwable`, so it walks the class hierarchy and only the class
hierarchy; an interface is never visited and `equals` never sees it. A pattern
rule could still match such an exception by name, but only by coincidence of
spelling, not because of the interface. The practical implication is for
exception designs that use a marker interface — `implements BusinessException` —
to group unrelated types: that grouping is invisible to rollback rules, and each
concrete class has to be named, or the hierarchy has to be reworked around a
common superclass.

**★ Where does the default rule actually live, and how would you find it from the
annotation?**
The annotation tells you. `@Transactional`'s javadoc for `rollbackFor` says "by
default, a transaction will be rolled back on `RuntimeException` and `Error` but
not on checked exceptions (business exceptions)" and then points at the
implementation: "see `DefaultTransactionAttribute.rollbackOn(Throwable)` for a
detailed explanation". Following that link gets you a one-line method. The object
the interceptor actually holds for an annotated method is a
`RuleBasedTransactionAttribute`, built by `SpringTransactionAnnotationParser` from
the annotation's attributes; it extends `DefaultTransactionAttribute`, which is
what makes the fallback a `super` call rather than a special case. Being able to
name those three classes is a reasonable proxy for having read how rollback
actually works, because the interesting behaviour is spread across exactly them.

**★ `@EnableTransactionManagement(rollbackOn = ALL_EXCEPTIONS)` — where does that
fit into this algorithm?**
It changes what the `winner == null` branch falls through to, and nothing else.
The rule list is untouched: your `rollbackFor` and `noRollbackFor` entries are
scored exactly as before, and the shallowest still wins. What the global setting
replaces is the *unmatched* case — instead of "roll back on `RuntimeException` or
`Error`", the default for exceptions no rule mentions becomes "roll back on
anything". The javadoc describes precisely that: "transaction-specific rollback
rules override the default behavior but retain the chosen default for unspecified
exceptions." Seeing it as a change to one branch is what makes the interaction
obvious rather than something to memorise — it explains why the switch does not
break `noRollbackFor`, and why it *does* change the behaviour of every method that
throws a checked exception without an explicit rule ([13b](13b-changing-the-rule.md)).

**★ Does Spring's `@Transactional` have `rollbackOn` and `dontRollbackOn`?**
No, and this is worth being firm about, because the names are in the ecosystem and
an IDE's completion will happily suggest them if the wrong import is in scope.
Spring's annotation has twelve attributes, and the four rollback ones are
`rollbackFor`, `rollbackForClassName`, `noRollbackFor` and
`noRollbackForClassName`. `rollbackOn` and `dontRollbackOn` belong to **JTA's**
`jakarta.transaction.Transactional`, which Spring also supports as a drop-in — so
a codebase can genuinely contain both spellings, on different annotations, doing
the analogous job. The confusion is compounded by `rollbackOn` existing in Spring
under a third meaning: as an attribute of `@EnableTransactionManagement`, where it
sets the global default rather than a per-method rule. Three uses of one word
across two annotations and two scopes, so the first thing to check when a rollback
attribute "does nothing" is which annotation was imported.

---

← Prev: [13c · How a rule is matched](13c-how-a-rule-is-matched.md) · Index: [04 · Spring @Transactional](README.md) · Next → [13e · When rules collide](13e-when-rules-collide.md)
