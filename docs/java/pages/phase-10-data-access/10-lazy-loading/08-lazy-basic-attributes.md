---
title: "A lazy basic attribute is the weakest promise in the specification — LAZY is defined as a hint, Hibernate honours it only if a build plugin rewrote your class, and an unenhanced build reads the column eagerly and tells nobody"
sidebar_label: "08 · Lazy basic attributes"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `@Basic` javadoc
> ([jakarta.ee/specifications/persistence/3.2/apidocs/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/basic)),
> the Hibernate ORM 7.4 *User Guide* §3.2.1 `@Basic` and §3.2.47 *Handling LOB data*
> ([docs.hibernate.org/orm/7.4/userguide/](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html)),
> and the Hibernate ORM 7.4 *Introduction* §4.10 *LOBs* and §9.15 *Using the bytecode
> enhancer*
> ([docs.hibernate.org/orm/7.4/introduction/](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)).
> Documentation build 7.4.6.Final. JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0,
> Hibernate ORM 7.4.1, Jakarta Persistence 3.2, PostgreSQL 18.

**Everything in this topic so far has been about a reference that was not followed. Column
laziness is the other kind: the entity is fully loaded, the object in your hand is the real
thing, and one of its fields has no value in it yet. That needs a mechanism a proxy cannot
supply, and the mechanism is a build step. Until that build step runs, `@Basic(fetch = LAZY)`
is documented to be ignored — no exception, no warning, no startup error, just a `select` that
reads the column every time. This chunk is what the annotation
promises and what Hibernate actually does with it — which, on an ordinary build, is
nothing.** Continues
**[07c · Triage and rollout](07c-triage-and-rollout.md)**.

## A proxy cannot stand in for a field

**[01 · What a proxy actually is](01-what-a-proxy-actually-is.md)** established the trick: a
lazy association is served by a generated subclass that holds the foreign key and a session
reference, and every method call on it is a place Hibernate can interpose. That works because
you reach the associated entity *through a reference*, and a reference can be swapped for a
stand-in.

A column is not reached through a reference. `book.fullText` is a field on an object that has
already been constructed and populated, and the read may come from inside `Book`'s own
methods — `this.fullText`, compiled to a `getfield` instruction, with no dispatch to intercept.
No subclass helps: `Book` is already the class you are running.

**So there is exactly one way to make a column lazy: change `Book`.** The enhancer rewrites
field access in the class itself so that the read goes through an interceptor. That is why
this feature has a build plugin and association laziness does not, and it is the whole reason
column laziness behaves differently from everything else in this topic.

## What the specification promises, which is very little

The Jakarta Persistence 3.2 javadoc for `@Basic` defines `fetch` in two sentences that are not
symmetric:

> *"The `EAGER` strategy is a requirement on the persistence provider runtime that the
> associated entity must be eagerly fetched. The `LAZY` strategy is a hint to the persistence
> provider runtime."*

and the default is **`EAGER`**. This is the same asymmetry as `FetchType` on an association —
one direction binds the provider, the other does not — but on a basic attribute it bites
harder, because for associations every provider implements the hint and for columns most do
not without help.

Hibernate's own annotation reference, §3.2.1, says exactly where it stands:

> *"`fetch` - `FetchType` (defaults to `EAGER`) Defines whether this attribute should be
> fetched eagerly or lazily. `EAGER` indicates that the value will be fetched as part of
> loading the owner. `LAZY` values are fetched only when the value is accessed. Jakarta
> Persistence requires providers to support `EAGER`, while support for `LAZY` is optional
> meaning that a provider is free to not support it. **Hibernate supports lazy loading of
> basic values as long as you are using its bytecode enhancement support.**"*

Read the last clause as a conditional, not as a footnote. Without enhancement Hibernate is one
of the providers that is "free to not support it", and it exercises that freedom silently.

## The failure direction: nothing happens

This is the part that catches people, and it is the opposite of every other failure in this
topic. The introduction, on a `@Basic(optional = false, fetch = LAZY)` field mapped to a text
column:

> *"**Without** the bytecode enhancer, this instruction is ignored, and the field is always
> fetched immediately, as part of the initial `select` that retrieves the `Book` entity.
> **With** bytecode enhancement, Hibernate is able to detect access to the field, and lazy
> fetching is possible."*

| | Enhancement off | Enhancement on |
|---|---|---|
| What the `select` reads | every mapped column, including the lazy one | the non-lazy columns only |
| Statement count | correct | correct, plus one per lazy group actually touched |
| Reading the field detached | works — the value is already there | throws (**[08c](08c-when-enhancement-is-on.md)**) |
| What tells you which mode you are in | nothing | nothing |

Two consequences worth stating plainly:

- **An unenhanced build cannot throw `LazyInitializationException` for a column.** If you are
  chasing a lazy-loading failure and the mapping is a `@Basic`, the first question is not
  "where is the session" but "did the enhancer run".
- **A statement-count assertion cannot detect the unenhanced case.** The number of statements
  is right; only the bytes are wrong. The count tooling in
  **[Topic 08 · 06b · Asserting the count](../08-the-n-plus-1-problem/06b-asserting-the-count-in-a-test.md)**
  is blind here, and that is the one gap in it.


**The mapping the documentation actually recommends for such a column, why `@Lob` is the wrong
reflex for it, and what happens when one lazy column quietly drags another with it, continue in
[08b · The `@Lob` reflex and the lazy group](08b-the-lob-reflex-and-the-group.md).**

## Gotchas

**★ Without enhancement, `@Basic(fetch = LAZY)` is not "less effective" — it is ignored.**
The documentation's word is *ignored*, and the column is fetched *"as part of the initial
`select`"*. There is no partial credit and no degraded mode. Every conclusion you draw from
watching the application behave is a conclusion about the eager mapping.


**★ Nothing in the toolchain reports which mode you are in.** No startup warning, no mapping
validation error, no log line. A build that stopped enhancing — a plugin dropped in a `pom.xml`
merge, a module split, an IDE that compiled the classes itself — reverts every lazy column to
eager silently, and the only symptom is size.


**★ A primitive field cannot express "not loaded" in your own code either.** `long` has no
null, so any manual "is it loaded" check you write over a primitive lazy attribute is
indistinguishable from a legitimately zero value. Ask Hibernate
(`Hibernate.isPropertyInitialized`) rather than inspecting the field.


**★ A statement-count test passes on an unenhanced build.** The statement count is identical;
what changed is the width of the row. This is the one failure in the whole data-access phase
that counting statements is structurally unable to see.


**★ Enhancement is per compiled module, so shared entity jars are usually unenhanced.**
If entities live in a library and the plugin is applied to the application, the classes on the
classpath were compiled and packaged without the rewrite. This is not visible in the
application's build file, which is where everyone looks.


## Interview questions

**★ Why does a lazy column need a build plugin when a lazy association does not?**
Because they intercept different operations. An association is reached through a reference, so
Hibernate can hand you a generated subclass and interpose on every method call — that can be
built at runtime. A column is a field on an object that has already been constructed, and the
read may be `this.fullText` from inside the entity's own method, compiled to a direct field
access with no dispatch. The only place to interpose is inside the class itself, which means
rewriting its bytecode. There is no runtime trick that reaches a `getfield` in code you already
compiled.


**★ You mapped a large column `@Basic(fetch = LAZY)` and the queries did not change. What is
your first hypothesis?**
That enhancement is not running, because that is the documented behaviour: without the
enhancer the instruction is ignored and the field is fetched as part of the initial select.
Not a caching problem, not a fetch-plan problem, not something an `@EntityGraph` can influence.
The check is on the build output, not the source — whether the Hibernate plugin is applied in
the module where that entity is compiled, and for Gradle whether the block form
`enhancement {}` was used, since the brace-less form is documented to silently do nothing.


**★ Your test asserts the endpoint issues exactly two statements and it passes. Does that prove
the lazy column is working?**
No, and this is the specific blind spot of statement counting. An ignored lazy mapping produces
the same number of statements as a working one — the column simply rides along in the select
that was already happening. The count is only sensitive to *extra* round trips; column laziness
changes the *width* of an existing one. To assert it you need something that inspects the
generated SQL text or the enhanced class file, not the statement count.


**★ Where does column laziness sit relative to the rest of this topic?**
Slightly outside it, and that is the useful thing to notice. Every other failure here comes
from following a reference after its session went away. This one comes from a field on a real,
fully-constructed object — so the diagnosis, the exception text and the fix are all different,
and the failure only exists at all if a build plugin ran. If the plugin has never run, a
`@Basic` mapping cannot be the cause of a `LazyInitializationException` you are looking at.

{/* FOOTER */}
