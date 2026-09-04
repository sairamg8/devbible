---
title: "When two rollback rules match the same exception the shallowest one wins — which is how a loose pattern quietly overrides the type rule you meant"
sidebar_label: "13e · When rules collide"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `RollbackRuleAttribute` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/RollbackRuleAttribute.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/interceptor/RollbackRuleAttribute.html)),
> the `RuleBasedTransactionAttribute` and `SpringTransactionAnnotationParser`
> sources
> ([github.com/spring-projects/spring-framework/.../transaction/annotation/SpringTransactionAnnotationParser.java](https://github.com/spring-projects/spring-framework/blob/main/spring-tx/src/main/java/org/springframework/transaction/annotation/SpringTransactionAnnotationParser.java))
> and the Spring Framework 7.0 reference *Rolling back a declarative transaction*,
> section *Strongest matching rule wins*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)).
> JDK 25, Spring Framework 7.0.9, Spring Boot 4.1.1.

**[Chunk 13d](13d-the-matching-algorithm.md) showed the loop: score every rule
with `getDepth`, keep the lowest score, fall back to the default if nothing
scored. This chunk is what that loop does when more than one rule matches. The
reference calls it "the strongest matching rule wins" and the javadoc calls it
"a rule with a lower matching depth wins", and both mean the same thing —
**closest to the thrown class, not first in the annotation.** The consequence
that actually bites is that a string pattern reaches depth `0` far more easily
than a type rule does, so the loose pattern somebody added last year silently
outranks the deliberate rule you are reading.**

## Depth, restated as a scoring rule

`getDepth` walks from the thrown exception's own class up to `Throwable`,
counting levels, and returns the level at which the rule matched — or `-1` if it
never did. The javadoc is explicit about how those numbers are compared:

> *"When comparing roll back rules that match against a given exception, a rule
> with a lower matching depth wins. For example, a direct match (`depth == 0`)
> wins over a match in the superclass hierarchy (`depth > 0`)."*

So the whole collision rule is: **whichever rule matches nearest the thrown
class.** The reference's worked example is the idiom for "everything except this
one" —

```java
@Transactional(
    rollbackFor   = Throwable.class,
    noRollbackFor = InstrumentNotFoundException.class)
public void quote(String instrument) { ... }
```

— where the second rule matches at depth `0` and the first matches several levels
up, so that one exception commits and every other rolls back.

## A pattern rule usually outranks a type rule

Because depth is measured from the thrown class upward, a rule that matches
*right at the thrown class* scores `0` and beats everything else. Pattern rules
hit depth `0` far more easily than type rules, because most exception class names
end in the letters other exception names contain.

Take a thrown `com.acme.OrderNotFoundException`, and:

```java
@Transactional(
    rollbackFor            = RuntimeException.class,   // matches at depth 2
    noRollbackForClassName = "NotFound")               // matches at depth 0
```

| Rule | How it matches | Depth |
|---|---|---|
| `noRollbackForClassName = "NotFound"` | `com.acme.OrderNotFoundException` contains `NotFound` | **0 — wins** |
| `rollbackFor = RuntimeException.class` | `OrderNotFoundException` → `RuntimeException` | 2 |

The no-rollback rule wins and the transaction commits. **Nothing about that is
visible from reading the annotation**, and it is exactly the situation the
reference warns about when it says a loose pattern "will match nearly anything
and will probably hide other rules". The mechanism behind that warning is this
depth comparison.

## An exact tie is decided by attribute order after all

`depth < deepest` is a strict comparison, so a later rule with the *same* depth
never displaces an earlier one. The order of the list is fixed by
`SpringTransactionAnnotationParser`, which adds them in the annotation's own
attribute order:

```java
for (Class<?> rbRule : attributes.getClassArray("rollbackFor")) { … }
for (String rbRule : attributes.getStringArray("rollbackForClassName")) { … }
for (Class<?> rbRule : attributes.getClassArray("noRollbackFor")) { … }
for (String rbRule : attributes.getStringArray("noRollbackForClassName")) { … }
```

So on an exact tie — the same type named in both `rollbackFor` and
`noRollbackFor`, say — the **rollback** rule wins, because it was added first.

⚠️ **Do not build on this.** It is a consequence of a strict `<` and an
iteration order, neither of which is a documented contract; a configuration that
names the same type in both attributes is a bug to delete, not a precedence
puzzle to solve. It is worth knowing only so that you recognise a tie as a
*defect* rather than looking for the rule that explains it.

## The trade-off

The specificity rule is the right one: it makes "everything except X" expressible
in two attributes, which no first-match rule could do. **What you pay is that
specificity is computed, not declared.** Reading a method's annotation does not
tell you which rule will win for a given exception — you have to know the thrown
class, walk its hierarchy, and score every rule against it, and the answer can
change when somebody renames a class in a different module. The way to keep the
cost at zero is to make collisions impossible rather than resolvable: use `Class`
rules only, never name a type in both `rollbackFor` and `noRollbackFor`, and keep
the whole rule set on a method small enough to hold in one thought.

## Gotchas

**⚠️ A pattern rule silently outranking a deliberate type rule**
**Symptom:** a `rollbackFor` that appears to do nothing on a specific exception.
**Cause:** a pattern rule matched the same exception at depth 0 and won.
**Fix:** do not mix the two styles on one method
([13c](13c-how-a-rule-is-matched.md)). If you must, work out both depths before
assuming which applies.

**⚠️ Naming the same type in `rollbackFor` and `noRollbackFor`**
**Symptom:** behaviour that looks arbitrary and changes if somebody reorders the
attributes in a refactor.
**Cause:** an exact depth tie, resolved by list order rather than by intent.
**Fix:** delete one of them. A tie is never a design.

**⚠️ Mixing `Class` rules and pattern rules on one method**
**Symptom:** an annotation whose outcome cannot be predicted by reading it.
**Cause:** the two styles are scored on the same depth scale but reach depth `0`
under completely different conditions — type identity versus string containment.
**Fix:** pick one style per method, and let it be the `Class` form unless a type
genuinely cannot be imported ([13c](13c-how-a-rule-is-matched.md)).

**⚠️ Reading attribute order as precedence**
**Symptom:** somebody reorders `rollbackFor` and `noRollbackFor` in a refactor and
expects a behaviour change.
**Cause:** order is irrelevant except in the exact-tie case, which should not
exist.
**Fix:** reason about depth. If order appears to matter, there is a tie, and the
tie is the bug.

## Interview questions

**★ How does Spring choose between two rules that both match?**
By depth. `RollbackRuleAttribute.getDepth` returns `-1` for no match, `0` for a
direct match on the thrown class, and otherwise the number of levels up the
superclass hierarchy at which the rule matched. `rollbackOn` keeps the rule with
the lowest non-negative depth, and the javadoc states the tie-break in words: "a
rule with a lower matching depth wins. For example, a direct match (depth == 0)
wins over a match in the superclass hierarchy (depth > 0)." The reference calls
this "the strongest matching rule wins", and its worked example is
`rollbackFor = Throwable.class` with
`noRollbackFor = InstrumentNotFoundException.class`: the second matches at depth
0 and the first at whatever the hierarchy distance to `Throwable` is, so the one
exception commits and everything else rolls back.

**★ Can a `noRollbackForClassName` pattern beat a `rollbackFor` type rule?**
Yes, routinely, and this is the sharpest practical consequence of the depth
algorithm. Depth is measured from the thrown class upward, and a pattern matches
as soon as a level's fully qualified name *contains* the string — which for most
exception names happens at the thrown class itself, depth 0. A type rule for a
supertype like `RuntimeException` matches two or three levels up. So
`noRollbackForClassName = "NotFound"` beats `rollbackFor = RuntimeException.class`
for a thrown `OrderNotFoundException`, and the transaction commits. Nothing in the
annotation shows the winner. This is the mechanism behind the reference's warning
that a loose pattern "will match nearly anything and will probably hide other
rules", and it is a strong argument for never mixing pattern rules and type rules
on the same method.

**★ What happens if two rules match at exactly the same depth?**
The first one in the list wins, because the comparison is strict — `depth <
deepest` — so an equal score never displaces the incumbent. The list order comes
from `SpringTransactionAnnotationParser`, which appends `rollbackFor`, then
`rollbackForClassName`, then `noRollbackFor`, then `noRollbackForClassName`, so
naming the same type in `rollbackFor` and `noRollbackFor` resolves to a rollback.
I would say all of that in an interview and then say the more important half:
neither the strict comparison nor the iteration order is a documented contract,
and a configuration that produces a tie is a defect to remove rather than a
precedence question to answer. Knowing the answer is useful mainly for
recognising the situation.

**★ Two engineers disagree about what a method does on a given exception. How do
you settle it?**
Not by reading the annotation, because the annotation does not contain the answer
on its own. Settle it by scoring: take the thrown exception's class, walk up its
superclass chain writing down the levels, and for each configured rule find the
first level at which it matches — `equals` for a `Class` rule, "name contains the
string" for a pattern rule. The rule with the smallest number wins, and if the
winner is a `NoRollbackRuleAttribute` the transaction commits. If no rule scores,
the default applies ([13d](13d-the-matching-algorithm.md)). That procedure is
short enough to do on a whiteboard and it is exact, which is more than can be said
for arguing about intent. If the disagreement was possible at all, it is also a
signal: a rule set whose outcome two competent readers cannot predict is a rule
set to simplify.

**★ Does the reference guarantee this, or is it implementation detail?**
The specificity rule is documented, twice — the reference has a section headed
*Strongest matching rule wins* and the `RollbackRuleAttribute` javadoc states the
depth comparison explicitly — so relying on "shallowest wins" is relying on
contract. The tie behaviour is not. That one comes from a strict `<` in a loop and
from the order in which `SpringTransactionAnnotationParser` happens to append the
four attribute groups, and neither is promised anywhere. That is the line I would
draw in an interview: design against the documented rule, know the undocumented
one only well enough to recognise a tie as a defect rather than treating it as a
feature.

---

← Prev: [13d · The matching algorithm](13d-the-matching-algorithm.md) · Index: [04 · Spring @Transactional](README.md) · Next → [14 · The caught exception](14-the-caught-exception.md)
