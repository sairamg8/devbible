---
title: "AspectJ weaving is the only option that makes the ignored annotation actually work, because there is no proxy left to bypass"
sidebar_label: "4c · AspectJ weaving"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html))
> *Using `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and the `AnnotationTransactionAspect` source in `spring-aspects`
> ([github.com/spring-projects/spring-framework/.../AnnotationTransactionAspect.aj](https://github.com/spring-projects/spring-framework/blob/main/spring-aspects/src/main/java/org/springframework/transaction/aspectj/AnnotationTransactionAspect.aj)).
> JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9.

**The four fixes in [chunk 4](04-fixing-self-invocation.md) and
[chunk 4b](04b-the-escape-hatches.md) all work by moving where the transaction is
declared. This one is different: it leaves your code exactly as it was and makes
the annotation you wrote start being honoured. It can do that because it stops
using proxies. The reason it is still the fourth-ranked option is that the price
is a build.**

## 5 · AspectJ weaving — the only fix that removes the limitation

```java
@EnableTransactionManagement(mode = AdviceMode.ASPECTJ)
class TxConfig { }
```

**Verdict: correct, and almost never worth adopting for this reason alone.**

The reference is unambiguous that this is the one approach without the problem:

> *"AspectJ compile-time weaving and load-time weaving do not have this
> self-invocation issue."*

They do not have it because there is no proxy. The advice is woven into the
bytecode of the method itself, so *every* invocation of that method is advised —
internal, external, from a lambda, from a default method, from a constructor. The
`this` call is intercepted because the interception is inside the callee.

What it costs, and this is why the verdict is what it is:

| Cost | Detail |
|---|---|
| build or runtime setup | compile-time weaving needs the AspectJ compiler in the build; load-time weaving needs `-javaagent` or `@EnableLoadTimeWeaving` plus `spring-instrument` |
| a second dependency | `spring-aspects` on the classpath |
| interface annotations stop working | the weaver does not see annotations declared on interfaces — the reference's own warning, and [chunk 2c](02c-visibility-and-the-interface-question.md)'s |
| harder debugging | the stack trace no longer shows a proxy frame, so *where* the transaction started is less obvious, not more |
| an application-wide switch | `mode = ASPECTJ` changes how every transactional bean is advised |

Adopt AspectJ mode because your architecture needs weaving, not to rescue one
`this.` call. If self-invocation is the only reason on the table, fix number 1 is
one class and no infrastructure.

## The decision table

| Situation | Fix |
|---|---|
| ordinary case, a method that should be its own unit of work | **1 · extract to a bean** ([chunk 4](04-fixing-self-invocation.md)) |
| one legacy class you are not allowed to split today | 2 · self-injection, with a comment saying why |
| a boundary smaller than a method | 4 · `TransactionTemplate` ([chunk 4b](04b-the-escape-hatches.md)) |
| initialization / startup work | 4 · `TransactionTemplate`, or defer past startup |
| propagation or timeout that depends on the input | 4 · `TransactionTemplate` |
| you already weave, for other reasons | **5 · AspectJ — the problem disappears** |
| none of the above | 1 |
| — | **never 3 · `AopContext`** |

## The trade-off

This is the only *repair* on the list, and it is the most expensive item on it.
Every other option asks you to change one class or one call; this one asks you to
change how the application is built or launched, accept a dependency, and give up
interface-declared annotations across the whole codebase.

Notice the asymmetry that keeps AspectJ being proposed and rarely adopted: fixes 1 to
4 all work by **moving where the transaction is declared**, and only this one makes the
declaration that was ignored start being honoured. Self-invocation, under proxying, is
never repaired — it is designed around.

So weigh weaving as an architecture decision — "do we want advice inside our methods?"
— never as a bug fix. If the answer is yes, self-invocation stops being a topic
entirely. If it is no, [extracting a bean](04-fixing-self-invocation.md) costs one
class and no infrastructure.

## Gotchas

**⚠️ Switching to `mode = ASPECTJ` with annotations on interfaces**
**Symptom:** transactions disappear across a swathe of the application after a
build change.
**Cause:** the weaver does not recognise interface-declared annotations, so the
aspect is not applied.
**Fix:** annotate concrete classes before switching, which is the recommendation
regardless.

**⚠️ Load-time weaving configured but the agent not attached**
**Symptom:** no weaving, no error, and behaviour identical to having no
transaction infrastructure at all.
**Cause:** LTW needs `-javaagent:spring-instrument.jar` or a container that
provides instrumentation.
**Fix:** verify the agent is present at startup rather than assuming
configuration implies effect.

**⚠️ The agent present in one environment and not another**
**Symptom:** tests pass locally and transactions are missing in production, or
the reverse.
**Cause:** a `-javaagent` flag lives in launch configuration, which drifts
between environments in a way build configuration does not.
**Fix:** prefer compile-time weaving when you control the build, precisely
because the behaviour then travels with the artifact.

**⚠️ Adopting AspectJ and then debugging a transaction boundary**
**Symptom:** the stack trace shows your method calling your method, with no frame
indicating where the transaction began.
**Cause:** the advice is inside the method, not in a proxy frame above it.
**Fix:** nothing to fix — but know that weaving makes boundaries *less* visible
in a stack trace, not more, which is the opposite of the usual assumption.

**⚠️ Forgetting `spring-aspects` on the classpath**
**Symptom:** `mode = ASPECTJ` is set and nothing is woven.
**Cause:** the aspect Spring weaves in (`AnnotationTransactionAspect`) ships in
`spring-aspects`.
**Fix:** add the dependency. Note that Spring Boot 4 renamed the AOP starter from
`spring-boot-starter-aop` to `spring-boot-starter-aspectj`, so a copied snippet
from an older project will not resolve.

**⚠️ Assuming the visibility rules are the same under weaving as under proxying**
**Symptom:** a `private` method that was inert under proxying starts opening a
transaction after the migration — or a non-public method that inherits its
transactionality from a class-level annotation does not.
**Cause:** the aspect's two pointcuts are not symmetric. A class-level
`@Transactional` matches `execution(public * ((@Transactional *)+).*(..))` — public
methods only, including in subtypes — while a *directly annotated* method matches
`execution(@Transactional * *(..))` with no visibility restriction at all. The aspect's
own javadoc spells it out: "Any method may be annotated (regardless of visibility).
Annotating non-public methods directly is the only way to get transaction demarcation
for the execution of such operations."
**Fix:** audit for `@Transactional` on non-public methods *before* switching. Under
proxying a `private` one was guaranteed dead; under weaving it is live.

**⚠️ Treating "every invocation is advised" as purely good news**
**Symptom:** a helper called in a tight loop, previously untransactional by
accident, now opens and commits a transaction per iteration.
**Cause:** weaving honours annotations that proxying was silently ignoring —
including ones nobody intended to be live.
**Fix:** audit every `@Transactional` in the codebase before switching. A
migration to weaving turns dormant annotations into behaviour.

## Interview questions

**★ Does AspectJ weaving really eliminate the self-invocation problem, and what
does it cost?**
Yes, genuinely, and the reference says so: "AspectJ compile-time weaving and
load-time weaving do not have this self-invocation issue." It works because there
is no proxy at all — the advice is woven into the bytecode of the target method,
so every invocation is advised no matter where it comes from, including a `this`
call, a lambda, a default method or a constructor. The costs are real: the
AspectJ compiler in your build or a `-javaagent` at runtime, the `spring-aspects`
dependency, an application-wide `mode = ASPECTJ` switch, and the loss of interface
annotations, since the weaver does not see annotations declared on interfaces. It
is the right choice when your architecture wants weaving for other reasons. It is
a very large lever to pull to fix one internal call, when moving that method to
another class fixes it with no infrastructure at all.

**★ Compile-time weaving or load-time weaving — how would you choose?**
Compile-time weaving happens in the build: the AspectJ compiler processes your
sources or class files and the shipped artifact already contains the advice. It
costs a build-tool change and a slower compile, and it gives you a deployable that
behaves the same everywhere with no runtime configuration. Load-time weaving
happens as classes are loaded, driven by a Java agent, so the artifact is ordinary
bytecode and the weaving is applied by the runtime. It costs a `-javaagent` flag
that every environment must set and every developer must remember, and its
characteristic failure is silence — if the agent is missing, nothing is woven and
nothing complains. For an application you control end to end, compile-time weaving
is the more predictable of the two; load-time weaving earns its place when you
cannot change how the artifact is built.

**★ Why does the reference recommend annotating concrete classes, and how does
that interact with a decision to weave?**
The two are the same recommendation seen from different ends. Java does not
inherit annotations from interfaces to implementing classes, so a weaver — which
processes bytecode with no knowledge of Spring's attribute-lookup logic — never
sees an interface-declared `@Transactional`. The reference states that the aspect
"does not get applied" in that case and warns the annotations "may be silently
ignored". Under proxying you get away with it because Spring's attribute source
deliberately searches the interface method. So a codebase that annotates
interfaces has a latent dependency on proxy mode, and the moment somebody enables
weaving, transactions vanish across whole packages with no error. Annotating
concrete classes removes that coupling and costs nothing, which is why it is the
recommendation whether or not you ever weave.

**★ What breaks when you migrate an existing application to `mode = ASPECTJ`?**
Three things, in decreasing order of how often they bite. Interface-declared
annotations stop working, which can silently remove transactions from a large
part of the application. Dormant annotations start working: every
`@Transactional` that was being ignored because of self-invocation is now live,
so methods that were running in autocommit are suddenly opening transactions —
including helpers called in loops, which can change connection usage
dramatically. And the debugging story changes, because the boundary no longer
appears as a proxy frame in a stack trace. None of these is a reason not to
migrate; all of them are reasons to audit every annotation in the codebase first
rather than flipping the switch and watching.

**★ If weaving is strictly more capable, why is proxying the default?**
Because the default has to be the thing that works with no setup. Proxy-based AOP
needs nothing beyond the framework itself: no compiler plugin, no agent, no build
integration, no special IDE support, and it behaves identically on every JVM and
in every packaging arrangement. That is what makes `@Transactional` a
one-annotation feature rather than a project. Weaving trades that away for
completeness — advice really is inside the method — and completeness is worth less
than zero-setup for the overwhelming majority of applications, especially when the
one limitation it removes is fixable by moving a method to another class. Spring
supports both and defaults to the one with the smaller adoption cost, which is the
right call.

**★ Rank all five fixes and defend the ranking.**
Extract to a second bean first, because it makes the boundary a visible design
decision and costs no framework knowledge, no configuration and no build step.
`TransactionTemplate` second, but only for the three jobs an annotation genuinely
cannot do — a sub-method boundary, initialization code, and a runtime-varying
configuration — and never as a default, since it couples business code to
Spring's transaction API. Self-injection third: it works, it keeps one file, and
it pays for that by putting a line in the code that only makes sense to someone
who knows about proxies. AspectJ weaving fourth, not because it is bad — it is
the only option that actually repairs the ignored annotation — but because the
infrastructure is disproportionate unless you want weaving anyway.
`AopContext.currentProxy()` last, and effectively never: Spring calls it highly
discouraged, it needs a global flag, its cast is unsafe, and it throws when the
method is reached by a path that is not a proxied invocation.

**★ Under AspectJ mode, does `@Transactional` on a `private` method work?**
Yes — and that reversal is one of the sharper surprises in a migration, because under
proxying a private method is guaranteed inert. The aspect has two pointcuts and they
have different visibility rules. A class-level annotation matches
`execution(public * ((@Transactional *)+).*(..))`, so it covers public methods of the
annotated type *and its subtypes* and nothing else. A method-level annotation matches
`execution(@Transactional * *(..))`, with no visibility clause — and the aspect's
javadoc states the consequence outright: "Any method may be annotated (regardless of
visibility). Annotating non-public methods directly is the only way to get transaction
demarcation for the execution of such operations." So the rule flips: under proxying,
private is never advisable; under weaving, private is advisable but only if annotated
directly, never by inheritance from the class. The migration risk runs in both
directions and neither produces a diagnostic.

**★ Why is "annotate the class, not the interface" not merely a recommendation under
weaving but a requirement?**
Because the aspect says so in its own documentation and the reason is a Java rule
rather than a Spring choice: "When using this aspect, you *must* annotate the
implementation class (and/or methods within that class), *not* the interface (if any)
that the class implements. AspectJ follows Java's rule that annotations on interfaces
are *not* inherited." Under proxying you get away with an interface annotation because
Spring's `AnnotationTransactionAttributeSource` deliberately searches the interface
method as part of its lookup — that is framework logic layered on top of the language.
A weaver has no such lookup; it matches bytecode against a pointcut, and the bytecode
of the implementation class carries no annotation. This is why an
interface-annotating codebase has a hidden dependency on proxy mode, and why the loss
is silent rather than a build error.

**★ The starter you need has been renamed in Boot 4. What is it now, and why did they
rename it?**
`spring-boot-starter-aop` became `spring-boot-starter-aspectj`, changed in the 4.0.0
milestones and documented in the Boot 4.0 migration guide. The reasoning is that the
old name described the wrong thing: the starter's actual job is pulling in
`spring-aspects` and AspectJ itself, whereas plain proxy-based Spring AOP arrives with
`spring-context` and never needed a starter at all. The practical consequences are two.
A copied build snippet from an older project silently fails to resolve after an upgrade,
which is at least a loud failure. And the rename is a hint worth taking: if your
application uses no `org.aspectj.lang.annotation` types, you probably did not need the
starter in the first place — and if you are reading this chunk because you want weaving,
the new name is the one to add.

---

← Prev: [4b · The escape hatches](04b-the-escape-hatches.md) · Index: [04 · Spring @Transactional](README.md) · Next → [5 · Annotations that do nothing](05-annotations-that-do-nothing.md)
