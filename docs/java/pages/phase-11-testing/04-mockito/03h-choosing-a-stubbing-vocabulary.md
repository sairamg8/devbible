---
title: "Mockito ships three interchangeable ways to say the same stubbing — when/then, do/when and BDDMockito's given/will — and because BDDMockito extends Mockito a single static import puts all of them in scope, so the choice is a project decision that nothing in the compiler will make for you"
sidebar_label: "03h · Choosing a stubbing vocabulary"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> section 19 (*"Aliases for behavior driven development"*) and section 29 (*"BDD style
> verification"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java),
> and the class javadoc plus the `BDDMyOngoingStubbing`, `BDDStubber` and `Then` declarations
> of
> [`BDDMockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/BDDMockito.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[03 · Stubbing](03-stubbing.md) and [03g · Stubbing voids](03g-stubbing-voids.md) covered two
syntaxes that differ in a way that matters — whether the method is really invoked. This chunk
covers the third, which differs in a way that does not: `BDDMockito` is a pure alias layer over
the other two. That makes the choice between them a readability decision, and readability
decisions that nothing enforces are exactly the ones a codebase ends up making three different
ways in three different packages.**

## The BDD aliases

Section 19 explains why they exist, and it is a genuine argument rather than sugar:

> *"The problem is that current stubbing api with canonical role of **when** word does not
> integrate nicely with **//given //when //then** comments. It's because stubbing belongs to
> **given** component of the test and not to the **when** component of the test. Hence
> `BDDMockito` class introduces an alias so that you stub method calls with
> `BDDMockito#given(Object)` method."*

```java
import static org.mockito.BDDMockito.*;

Seller seller = mock(Seller.class);
Shop shop = new Shop(seller);

public void shouldBuyBread() throws Exception {
  //given
  given(seller.askForBread()).willReturn(new Bread());

  //when
  Goods goods = shop.buyBread();

  //then
  assertThat(goods, containBread());
}
```

The `do…` family has aliases too, and note the terminal method is `given(mock)`, not
`when(mock)`:

```java
//given
willThrow(new RuntimeException("boo")).given(mock).foo();

//when
Result result = systemUnderTest.perform();

//then
assertEquals(failure, result);
```

The full mapping, from `BDDMockito`'s own declarations:

| Mockito | BDDMockito |
|---|---|
| `when(m.f()).thenReturn(x)` | `given(m.f()).willReturn(x)` |
| `.thenThrow(...)` | `.willThrow(...)` |
| `.thenAnswer(a)` / `.then(a)` | `.willAnswer(a)` / `.will(a)` |
| `.thenCallRealMethod()` | `.willCallRealMethod()` |
| `doReturn(x).when(m).f()` | `willReturn(x).given(m).f()` |
| `doThrow(e).when(m).f()` | `willThrow(e).given(m).f()` |
| `doAnswer(a).when(m).f()` | `willAnswer(a).given(m).f()` / `will(a).given(m).f()` |
| `doNothing().when(m).f()` | `willDoNothing().given(m).f()` |
| `doCallRealMethod().when(m).f()` | `willCallRealMethod().given(m).f()` |

`BDDMockito extends Mockito`, so a single static import of `org.mockito.BDDMockito.*` gives you
both vocabularies — which is convenient and is also how a codebase ends up with both in the
same file. Pick one per project.

⚠️ BDD verification (`then(person).should(times(2)).ride(bike)`) is the same idea on the other
side of the test and belongs to [05 · Verification](05-verification.md).

## When to prefer `do…` even for a non-void method

Four reasons, three of them mechanical and one of them a decision:

- **The test class contains a spy at all.** Mixing forms means every stubbing has to be checked
  individually for whether it triggers a real call. One form removes the question.
- **You are re-stubbing something already stubbed to throw.** `when` cannot do it, as shown
  above.
- **The method is on a mock created with `CALLS_REAL_METHODS`, `delegatesTo(...)` or
  `RETURNS_DEEP_STUBS`.** All three run something real during the `when` evaluation.
- **Team convention.** The javadoc explicitly blesses this: *"you may prefer to use these
  methods in place of the alternative with `when()`, for all of your stubbing calls."*

And when **not** to: on a plain mock in a class with no spies, `when(...).thenReturn(...)` is
type-safe and reads better. Giving that up by default costs you compile-time checking on every
stubbing in the codebase.

## BDD verification, named here and owned elsewhere

Section 29 adds the mirror image on the assertion side:

```java
given(dog.bark()).willReturn(2);

// when
...

then(person).should(times(2)).ride(bike);
```

and the class javadoc shows the rest of the `Then` vocabulary:

```java
person.ride(bike);
person.ride(bike);

then(person).should(times(2)).ride(bike);
then(person).shouldHaveNoMoreInteractions();
then(police).shouldHaveZeroInteractions();
```

including in-order verification:

```java
InOrder inOrder = inOrder(person);

person.drive(car);
person.ride(bike);
person.ride(bike);

then(person).should(inOrder).drive(car);
then(person).should(inOrder, times(2)).ride(bike);
```

`should()` is `verify()`, `should(mode)` is `verify(mock, mode)`, `shouldHaveNoMoreInteractions()`
is `verifyNoMoreInteractions(mock)` and `shouldHaveNoInteractions()` is
`verifyNoInteractions(mock)` — the source shows each one delegating directly. What those
verifications *mean*, and when they are over-specification, is
[05 · Verification](05-verification.md) and
[05d · Verifying too much](05d-verifying-too-much.md).

⚠️ `shouldHaveZeroInteractions()` appears in the class javadoc example above but the interface
in 5.23.0 declares `shouldHaveNoInteractions()` (since 3.0.1) alongside
`shouldHaveNoMoreInteractions()`. Treat the javadoc example as historical on that one name; I
could not confirm from the source that `shouldHaveZeroInteractions` still exists on `Then`.

## Deciding, and writing the decision down

There are three axes and they are independent:

1. **`when`/`then` versus `do…`/`when`** — a real behavioural difference on spies, partial mocks
   and re-stubbing; otherwise a style choice that trades compile-time type safety for uniformity.
2. **Mockito names versus BDD names** — no behavioural difference at all.
3. **Static import of `Mockito.*` versus `BDDMockito.*`** — importing `BDDMockito.*` puts *both*
   vocabularies in scope, because `BDDMockito extends Mockito`. Importing `Mockito.*` does not
   give you `given`/`will`.

That third point is why mixed files happen. A team adopts BDD, switches the import, and every
old `when(...)` still compiles. Nothing goes red, so nothing gets converted, and a year later the
package has both.

**The practical rule:** decide once, per project, and encode it — a Checkstyle/ArchUnit rule on
the import, or at minimum a line in the contributing guide. And prefer the `given`/`will` names
only if the tests are actually laid out with `// given // when // then` sections; the whole
argument for the alias is that *"stubbing belongs to **given** component of the test and not to
the **when** component"*, and it evaporates if there are no sections.


## The type-safety asymmetry survives the rename

The BDD layer mirrors the underlying API exactly, including its weak spot:

```java
BDDMyOngoingStubbing<T> willReturn(@Nullable T value);   // typed — mirrors thenReturn
BDDStubber            willReturn(Object toBeReturned);   // untyped — mirrors doReturn
```

So `given(repo.findById(id)).willReturn(x)` is compile-checked and
`willReturn(x).given(repo).findById(id)` is not, for exactly the reason
[03g](03g-stubbing-voids.md) gives. Renaming the methods did not change which form the compiler
can see through.

## Gotchas

**★ Mixing `when`/`then` and `given`/`will` in one test class.**
`BDDMockito extends Mockito`, so both compile after one static import. The result is a file
where the reader has to work out which idiom a line belongs to. Choose one per project.

**★ Reading `willThrow(e).when(mock).foo()` and expecting it to compile.**
The BDD stubber's terminal method is `given(mock)`, not `when(mock)`. The two vocabularies do
not interleave at that point.

**★ Reaching for `do…` everywhere to be safe, on a codebase with no spies.**
It works, but you have traded compile-time type checking on every stubbing for a hazard that is
not present. Adopt it as a convention deliberately, with the spy reason stated, not by default.

**★ `BDDMockito.then` colliding with AssertJ's `BDDAssertions.then`.**
Both are static, both are called `then`, both take one argument. A test file that statically
imports `org.mockito.BDDMockito.*` and `org.assertj.core.api.BDDAssertions.*` will resolve one of
them and produce an error about the *other* usage that says nothing about the collision. Qualify
one of the two, or do not use AssertJ's BDD entry point in Mockito-heavy tests.

**★ `then(...)` meaning two different things inside Mockito itself.**
`OngoingStubbing.then(Answer)` is an alias for `thenAnswer` — it takes an `Answer` and continues a
stubbing. `BDDMockito.then(mock)` starts a *verification*. Same word, opposite side of the test.

**★ `willReturn` on a `BDDStubber` assumed to be type-safe because `given(...).willReturn(...)`
is.**
The two overloads differ: `BDDMyOngoingStubbing.willReturn(T)` is typed,
`BDDStubber.willReturn(Object)` is not. The BDD names hide which of the two underlying forms you
are in.

**★ Adopting BDD names without given/when/then sections in the tests.**
The entire documented justification is that *"stubbing belongs to **given** component of the
test and not to the **when** component"*. With no sections, `given` is just a longer word for
`when` and the rename buys nothing.

## Interview questions

**★ What is `BDDMockito` and what problem does it solve?**
It renames the stubbing API so it reads correctly under given/when/then headings. Mockito's
argument is that stubbing belongs to the *given* section, but the method is called `when` — which
collides with the *when* section of the test. `given(...).willReturn(...)` and
`willThrow(...).given(mock).foo()` fix the collision. `BDDMockito extends Mockito`, so it is a
pure alias layer, not different behaviour.

**★ Would you use `do…` for all stubbing in a project?**
The javadoc explicitly allows it — *"you may prefer to use these methods in place of the
alternative with `when()`, for all of your stubbing calls"* — and it is the right call in a
codebase that uses spies, partial mocks or `delegatesTo`, because it removes a per-line hazard.
In a codebase of plain mocks it costs compile-time type checking on every stubbing for no
benefit, so `when`/`thenReturn` stays the default.

**★ Why does importing `org.mockito.BDDMockito.*` not remove the old syntax from a file?**
Because `BDDMockito extends Mockito`, so a static import of `BDDMockito.*` brings in every static
member of `Mockito` as well — `when`, `verify`, `mock`, all of it. Nothing breaks when a
developer keeps writing `when(...)`, which is exactly why a project that "switched to BDD" often
has both idioms a year later.

**★ Is `given(...).willReturn(...)` type-safe?**
Yes — `BDDMyOngoingStubbing<T>.willReturn(T)` is parameterised by the stubbed method's return
type, mirroring `thenReturn`. But `willReturn(x).given(mock).f()` is *not*, because the
`BDDStubber` overload takes `Object`, mirroring `doReturn`. The BDD names preserve the
asymmetry rather than removing it.

**★ How would you stop a codebase drifting between the three stubbing vocabularies?**
Make the import the rule and enforce it — an ArchUnit or Checkstyle constraint on which static
import is allowed in test sources — because the compiler will never object. A convention that
lives only in a wiki page loses to the fact that every form compiles.

{/* FOOTER */}
