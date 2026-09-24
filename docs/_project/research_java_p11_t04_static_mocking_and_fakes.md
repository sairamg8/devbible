---
name: research-java-p11-t04-static-mocking-and-fakes
description: Verified Mockito 5.23.0 source and wiki research behind devbible Java Phase 11 topic 04 chunks 10-13 — the forbidden static-mock targets, the EXCLUDES list, MockedStatic's thread scope, and the quotes Mockito's own docs give for not mocking types you do not own.
metadata:
  type: project
---

# Java P11 T04 · static mocking, partial mocks and fakes — verified 2026-08-28, tag `v5.23.0`

Behind the committed chunks `10`–`13` (48 chunks, positions 50–63, 187 ★). **Topic 04 is
content-complete except `08-spies`, `09-injectmocks` (research in
[[research-java-p11-t04-mockito-strictness-spies-injectmocks]]), a renumber, `12c` and the index.**

## Navigating the source

`Mockito.java` v5.23.0's sections are numbered and greppable: `grep -n '^ \* <h3' Mockito.java`.
Relevant: **13** spying · **16** real partial mocks · **30** spying abstract classes · **39**
final/enums · **47** `clearInlineMocks` · **48** static mocks · **49** mocked construction ·
**50** proxy maker · **51** `@DoNotMock` · **56** `mockSingleton` (**new in 5.22.0**).

Wiki as raw markdown: `raw.githubusercontent.com/wiki/mockito/mockito/How-to-write-good-tests.md`,
`.../FAQ.md`, `.../Mockito-And-Private-Methods.md`.

## 🔴 Forbidden static-mock targets — from source, not docs

`InlineDelegateByteBuddyMockMaker.createStaticMock` refuses:
- `ConcurrentHashMap` — *"to avoid infinitive loops within Mockito's implementation of static
  mock handling"*
- `Thread`, `System`, `Arrays`, **any `ClassLoader` subtype** — *"to avoid interfering with
  class loading what leads to infinite loops"*

`InlineBytecodeGenerator.EXCLUDES`: `Class`, `String`, `WeakReference`, **all eight wrappers**.
Reported as *"Cannot mock primitive wrapper types, String, Class, or WeakReference"*.

**Sealed abstract enums** (`prettifyFailure`): *"Sealed abstract enums can't be mocked. Since
Java 15 abstract enums are declared sealed, which prevents mocking. You can still return an
existing enum literal from a stubbed method call."*

**Never stubbable** (`Reporter`): *"Following methods \*cannot\* be stubbed/verified:
final/private/equals()/hashCode()."*

## `MockedStatic` — the scope rule that causes cross-test leakage

Type javadoc: *"The mocking only affects the thread on which this static mock was created and
it is not safe to use this object from another thread… **If this object is never closed, the
static mock will remain active on the initiating thread.**"*

`ScopedMock`: `close()` *"throws an exception if already closed"*; `closeOnDemand()` *"is
non-operational if already released"*.

`@Mock` on a `MockedStatic<T>` field works — *"Automatically detects static mocks of type
`MockedStatic` and infers the static mock type of the type parameter."*

`mockConstructionWithAnswer`'s `@param` text is the spec: *"defaultAnswer — the default answer
for the first created mock"* / *"additionalAnswers — … For any access mocks, the last answer is
used."*

## The partial-mock warning, verbatim (§16 and `CALLS_REAL_METHODS`)

> *"Object oriented programming is more-or-less tackling complexity by dividing the complexity
> into separate, specific, SRPy objects. How does partial mock fit into this paradigm? Well, it
> just doesn't… Partial mock usually means that the complexity has been moved to a different
> method on the same object."*

Escape clause: *"code you cannot change easily (3rd party interfaces, interim refactoring of
legacy code etc.) However, I wouldn't use partial mocks for new, test-driven and well-designed
code."*

## Don't mock types you don't own — the wiki's own words

> *"TDD is just as much about design as it is about test, when mocking an external API the test
> cannot be used to drive the design, the API belongs to someone else ; this third party can and
> will change the signature and behaviour of the API."*

Plus the "…and **Boom**" upgrade story, the wrapper prescription, and the *"abstraction
leakage"* warning. Also *"Don't mock value objects"* / *"Because instantiating the object is too
painful !? => not a valid reason"*, and the `CustomerCreations` object-mother example.

**Private methods** (wiki): *"from the standpoint of testing, private methods don't exist"*; the
documented workaround is widening visibility; *"In OO you want objects (or roles) to
collaborate, not methods."*

## The fact that carries `10b`'s worked example

**`HttpClient.send` throws only** `IOException`, `InterruptedException`,
`IllegalArgumentException` — **an HTTP 404 is not an exception.** A mock that stubs a 404 as a
thrown exception encodes a guess the real client never makes.

**JDK `Clock`**: *"Best practice for applications is to pass a `Clock` into any method that
requires the current instant and time-zone… allows an alternative clock, such as fixed or
offset to be used during testing."*

## Three claims stated as uncertain in place — do not "resolve" them by guessing

1. **Which static methods are JVM intrinsics.** `mockStatic`'s javadoc says intrinsics *"cannot
   typically be mocked"* without enumerating them. ⚠️ in `11-static-and-final.md`.
2. **Whether `mockConstruction` intercepts subclasses of the named type.** The javadoc says
   nothing either way. ⚠️ in `11c-mocking-construction.md`, with the advice to name the exact class.
3. **`MockedConstruction.Context.getCount()` has no javadoc.** Its 1-based meaning is read from
   `mockConstructionWithAnswer`'s source (`getCount() == 1`, `additionalAnswers[getCount() - 2]`)
   and is flagged as source-derived, not documented.

## Naming that diverged from the dispatch — the map that matters for the renumber

- The `10`-series needed three more concept splits and runs to **`10g`**.
- `11` split four ways, so **`11b` is `11b-static-mocking-as-a-design-signal.md`**; construction
  is **`11c`**, final/enums **`11d`**.
- **`12b` is `12b-what-a-fake-costs.md`**, not the draft name `12b-contract-testing-a-fake.md`.

⚠️ **The fork reported that all inbound references to the old `12b` draft name were "repointed
and verified". Two were still dangling** and were caught by the filesystem-resolved link loop
and fixed by the coordinator — converted to bold **12c · Contract-testing a fake**
*(not written yet)*, since the technique is promised twice in `12b`'s prose and is genuinely
missing content. **`12c` is owed.** This is why a fork's link report is not accepted without
running the loop.

## Two intentional dangling links, by design

`08-spies.md` (from `10`, `10d`) and `09-injectmocks.md` (from `10c`) — the other fork's
guaranteed filenames, still unwritten. In `13-the-checklist.md` both are bold plain text +
*(not written yet)* instead. **If 08/09 land, those two checklist rows become links.**

⚠️ `01-junit-5/README.md` did not exist when `13-the-checklist.md` was written, so it links
`../01-junit-5/01-what-a-test-is-for.md`. **Repoint it when the index is written.**
