---
title: "The design case against a shared domain jar loses arguments; the operational one does not — two services on different versions of the same type fail in five distinct ways, not one of them caught at build time, and the worst of them happens inside a single deployable"
sidebar_label: "16b · What version skew does at runtime"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Maven `dependency:tree` and Gradle `dependencyInsight`
> documentation, and the Gradle `java-library` plugin documentation
> ([docs.gradle.org](https://docs.gradle.org/current/userguide/java_library_plugin.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[16 · The shared model jar](16-the-shared-model-jar.md) argues that a common domain library cancels every service boundary at compile time. That argument is correct and it frequently loses, because "our services are coupled" is an abstraction and the jar is right there being convenient. This chunk is the version of the argument that wins, which is not about coupling at all: it is a list of production failures the team has personally debugged, all of which become possible the moment two services carry different versions of the same type — and none of which the build catches, because each service built successfully on its own, months apart.**

## What version skew actually does at runtime

The design argument against the shared jar is coupling. The operational argument is more concrete and
lands harder in a review, because it is a list of failures people have personally debugged.

Two services on different versions of the same shared type do not fail at build time — they built
fine, separately, months apart. They fail like this:

| Skew | What happens | When you find out |
|---|---|---|
| A field was added in 1.5, producer on 1.5, consumer on 1.4 | The consumer deserialises and silently drops it | When a business number is wrong |
| A method was removed in 1.5, consumer compiled against 1.4 | `NoSuchMethodError` at the call site | At runtime, on the path that calls it |
| A type moved package in 1.5 | `ClassNotFoundException`, or a serialisation failure naming a class nobody recognises | On deploy, if you are lucky |
| An enum gained a constant in 1.5 | `IllegalArgumentException` in `valueOf` on the 1.4 side | The first time the new value occurs in production |
| Two libraries each depend on a different version | 🔴 **The build picks one.** Half the application runs against a version it was not compiled with | Anywhere, later, mysteriously |

🔴 **The last row is the one to make people feel.** Maven and Gradle both resolve a single version per
dependency, so a diamond — service → library A → common-domain 1.4, and service → library B →
common-domain 1.6 — does not produce an error. It produces *one* version on the classpath and code
compiled against the other one running against it. Every failure mode above becomes possible inside a
single deployable, and the stack trace points at the symptom rather than the resolution.

```bash
# Which version actually won, and who wanted what
mvn dependency:tree -Dincludes=com.retailer:common-domain
./gradlew :order-service:dependencyInsight --dependency common-domain
```

**The reason this argument works where the coupling argument does not** is that it converts an
abstract design objection into a category of incident the team can recognise. "Our services are
coupled" invites debate; "any two services on different versions of this jar can fail these five ways
and none of them is caught at build time" does not.

## Gotchas

**★ Treating a provider-published client library as the same thing.** It is not, provided the
provider owns it, versions it, and consumers may lag. The danger is a library *shared between
peers*, where nobody owns it and everyone must move together.

**★ Symptom: `NoSuchMethodError` or a mystery `ClassNotFoundException` in a service nobody changed.**
Cause: version skew on the shared jar, resolved transitively. Two libraries wanted different versions,
the build picked one, and some of the code on the classpath was compiled against the other.
Fix: find out which version won and who asked for it before theorising about anything else:
```bash
mvn dependency:tree -Dincludes=com.retailer:common-domain
```
🔴 The long-term fix is not a version-pinning policy. It is that a type shared across services has this
failure mode permanently, and pinning only decides which version everyone is wrong about together.

**★ Symptom: a producer adds a field and a consumer silently drops it, with no error anywhere.**
Cause: the consumer is on an older version of the shared type, so the field does not exist to
deserialise into. Nothing fails; a number is quietly wrong.
Fix: this is the failure that makes the shared jar worse than a wire contract, because a wire contract
at least has an explicit compatibility policy and a schema. Duplicate the type per service and treat
the JSON or event schema as the contract — [28 · Published language vs aggregate](28-published-language-vs-aggregate.md).

**★ Sharing test fixtures or builders across services.** The same mechanism with less
visibility: a change to a shared test builder breaks other teams' builds, and now your test
code has the coupling your production code avoided.

## Interview questions

**★ The design argument against a shared model jar does not land with your team. What is the operational one?**
That two services on different versions of the same shared type fail in five distinct ways, none of
which is caught at build time, because each service built successfully on its own months apart. A
field added upstream is silently dropped by an older consumer, so a business number is wrong with no
error. A removed method is a `NoSuchMethodError` at runtime on whichever path calls it. A moved type
is a `ClassNotFoundException` or an unrecognisable serialisation failure. A new enum constant is an
`IllegalArgumentException` on the older side the first time it occurs in production. And the worst
one, which happens inside a single deployable: a diamond where two libraries want different versions
resolves to **one** version on the classpath, so code compiled against the other runs against it and
any of the previous four failures becomes possible with a stack trace that points at the symptom
rather than the cause. That argument works where "our services are coupled" does not, because it names
incidents people have personally debugged.

**★ A team proposes putting the API DTOs in a shared jar so the client and server cannot
drift. What is your response?**
That preventing drift is the problem, not the goal. A consumer compiling against the
provider's DTO class cannot be a tolerant reader — an unknown field becomes a compile or
deserialisation concern rather than something to ignore — so the provider loses the ability to
add fields freely, which is the cheapest kind of API evolution there is. The acceptable form
is a client library that the *provider* owns and versions, which consumers may lag behind by
several versions. The unacceptable form is a jar shared between peers with no owner, where
everybody must move at once.

---

← [The shared model jar](16-the-shared-model-jar.md) · [Topic index](README.md) · Next → [The god service](17-the-god-service.md)
