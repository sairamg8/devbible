---
title: "When a target type is not in the implicit conversion table JUnit goes looking through your own production code for a single-String factory, which makes a CSV table of domain values work with no converter at all — and makes adding a second overload to an unrelated value class break a test in a module that never imports it"
sidebar_label: "08k · Fallback conversion"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Fallback String-to-Object
> Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `DefaultArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/DefaultArgumentConverter.html))
> page, and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08](08-conversion-and-aggregation.md) covered the two closed mechanisms: widening, and a
fixed table of about thirty implicit converters. This is the third one, and it is different in
kind — its trigger is not in JUnit and not in your test, it is in the *target type*. That makes
it the most convenient feature in this topic and the only one whose behaviour a production
refactoring can silently remove.**

## The rule

> *"In addition to implicit conversion from strings to the target types listed in the above
> table, JUnit Jupiter also provides a fallback mechanism for automatic conversion from a
> `String` to a given target type if the target type declares exactly one suitable factory
> method or a factory constructor as defined below."*
>
> *"**factory method**: a non-private, static method declared in the target type that accepts
> either a single `String` argument or a single `CharSequence` argument and returns an instance
> of the target type. The name of the method can be arbitrary and need not follow any particular
> convention."*
>
> *"**factory constructor**: a non-private constructor in the target type that accepts a either
> a single `String` argument or a single `CharSequence` argument. Note that the target type must
> be declared as either a top-level class or as a `static` nested class."*

The guide's example:

```java
@ParameterizedTest
@ValueSource(strings = "42 Cats")
void testWithImplicitFallbackArgumentConversion(Book book) {
    assertEquals("42 Cats", book.getTitle());
}

public class Book {

    private final String title;

    private Book(String title) {
        this.title = title;
    }

    public static Book fromTitle(String title) {
        return new Book(title);
    }

    public String getTitle() {
        return this.title;
    }
}
```

`Book` knows nothing about JUnit. Its constructor is `private` and irrelevant; the `public
static` single-`String` method is found reflectively and used. Note the name — `fromTitle`, not
`valueOf` or `parse` — because *"the name of the method can be arbitrary"*. There is no
convention to follow and, more to the point, no convention to *rely* on: any method with the
right shape qualifies, whether or not it was meant to be a parser.

## The tie-breaking rules are the whole story

> *"If multiple factory methods are discovered, they will be ignored. If a factory method and a
> factory constructor are discovered, the factory method will be used instead of the
> constructor."*

Read the first sentence twice. **Multiple candidates disable the fallback entirely.** They do
not produce an ambiguity error naming the two methods; the mechanism simply does not apply, and
the failure you get is a conversion failure for the parameter.

So this sequence is possible and has nothing to do with tests:

1. `Iban` has `public static Iban parse(String)`. A `@CsvSource` of IBAN strings works.
2. Six months later someone adds `public static Iban parse(CharSequence)` — or
   `public static Iban of(String)`, or a `fromString` helper for a JSON mapper.
3. There are now two suitable factory methods, so the fallback stops applying.
4. A test in a module that does not import the new method turns red, and the diff that caused
   it touched neither the test nor the table.

🔴 **6.0 widened the signature it looks for, which makes step 2 an upgrade hazard rather than
just a refactoring hazard:**

> *"Fallback String-to-Object Conversion for parameterized tests now supports factory methods
> and factory constructors that accept a single `CharSequence` argument in addition to the
> existing support for factories that accept a single `String` argument."*

A class that already had both `of(String)` and `of(CharSequence)` had exactly *one* suitable
factory under 5.x — the `String` one — and has *two* under 6.0. The conversion worked before the
upgrade and does not after, with no code change on either side. I have seen no tutorial mention
this and it is a genuine 5→6 break.

## Used deliberately, it is the cleanest thing here

```java
@ParameterizedTest
@CsvSource({
    "DE89370400440532013000, true",
    "DE89370400440532013001, false"
})
void validatesChecksum(Iban iban, boolean expected) {
    assertThat(iban.hasValidChecksum()).isEqualTo(expected);
}

// In production code, untouched by the test:
public record Iban(String value) {
    public static Iban parse(String value) { … }
}
```

A CSV table of domain values, with no converter class, no `@ConvertWith`, and no
`@MethodSource`. That is the argument for value types with a single parse method, made by the
test framework rather than by a style guide.

⚠️ A `record` deserves a note. `record Iban(String value)` has a canonical constructor taking a
single `String`, which is itself a **factory constructor**. So a single-component `String` record
converts from a CSV cell with no `parse` method at all — and adding one gives you a factory
method *and* a factory constructor, which the documented rule resolves in favour of the method.
That is the one multi-candidate case with a defined outcome.

## What it is not

The fallback is not an extension point. There is no interface to implement, no annotation to
declare, nothing to register, and therefore nothing that says at the call site "this conversion
happens". A reader of the test sees a `String` in a table and an `Iban` in a signature, and has
to know this mechanism exists to connect them.

When the conversion is doing real work — a format, a validation, a default — say so explicitly
with `@ConvertWith` ([08l](08l-explicit-conversion.md)). When it is `"DE89…"` becoming an
`Iban`, the fallback is the right amount of ceremony, which is none.

## Gotchas

**★ Adding a second single-`String` factory to a value type.** Multiple discovered factory
methods are *ignored*, not disambiguated — the fallback switches itself off. A refactoring in
production code breaks a parameterized test in a module that does not import it, and the diff
looks unrelated.

**★ A class with both `of(String)` and `of(CharSequence)` after upgrading to 6.0.** In 5.x only
the `String` one counted; in 6.0 both are suitable, so there are two candidates and the fallback
stops applying. Silent on upgrade, and the error names the parameter rather than the class.

**★ A factory constructor on a non-`static` nested class.** The documentation requires the target
type to be *"a top-level class or a `static` nested class"*. An inner class has an implicit
enclosing-instance parameter, so its "single-`String`" constructor is not single-argument at the
bytecode level.

**★ Relying on the fallback for a type you do not own.** It works on any class with a suitable
factory, including third-party ones — and a library upgrade that adds an overload removes the
conversion. For types outside your control, `@ConvertWith` states the intent explicitly and
cannot be revoked by someone else's release.

**★ Assuming the factory method must be named `valueOf`, `of` or `parse`.** It need not; any
name qualifies. That cuts both ways — a `static Book fromJson(String)` helper is a suitable
factory whether or not you wanted it to be, and its presence alongside a real parser makes two
candidates.

**★ Expecting a `private static` factory to be used.** It must be non-private. The guide's
example has a `private` *constructor* and a `public static` method, which is the shape that
works; the reverse is not.

**★ A factory that returns a subtype.** The documented requirement is a method that *"returns an
instance of the target type"*. I could not confirm from the documentation whether a covariant
return type qualifies — do not build on it.

**★ Forgetting that a single-component `String` record already has a factory constructor.** The
canonical constructor qualifies, so the conversion may be working for a reason you did not
intend, and adding a `parse` method silently changes which code path runs.

**★ Treating a conversion failure as a test failure.** The fallback runs during argument
resolution, before the test body. Nothing under test has executed. The bug is in the table, the
signature, or the target type's factories.

**★ Using the fallback where the string is not the type's natural written form.** A cell that
becomes an object through a factory nobody would call by hand is an encoding, not a value. That
is when a `@MethodSource` returning real objects ([04](04-methodsource.md)) is the honest
version.

## Interview questions

**★ What is the fallback String-to-Object conversion?**
When a target type is not in the implicit conversion table, JUnit looks for exactly one suitable
factory on that type: a non-private `static` method taking a single `String` or `CharSequence`
and returning the type, or a non-private constructor taking a single `String` or `CharSequence`.
If it finds exactly one, it uses it. The method's name is irrelevant.

**★ Why is it dangerous?**
Because its trigger lives in production code, not in the test. Adding a second suitable factory
makes the candidates ambiguous, and the documented behaviour is that multiple factory methods
*"will be ignored"* — so the conversion silently stops working, in a test the refactoring never
touched.

**★ Factory method or factory constructor — which wins?**
The factory method. The documentation says so explicitly: if both are discovered, the method is
used instead of the constructor. That is the one multi-candidate situation with a defined
outcome; two factory *methods* have none.

**★ What changed about it in JUnit 6?**
It now also accepts factories taking a single `CharSequence`, not just a single `String`. The
upgrade hazard is a class that has both overloads: one suitable factory under 5.x, two under
6.0, so the fallback disables itself and a previously green test fails with nothing in the diff
to explain it.

**★ Does a record work with it out of the box?**
A single-component `String` record does, because its canonical constructor is a non-private
constructor taking a single `String` — a factory constructor by the definition. That is
convenient and worth knowing about, because adding a `parse` method to such a record changes
which of the two is used, even though both produce the same object today.

**★ When would you not rely on it?**
When you do not own the target type, when the conversion does real work that a reader should
see, or when the string in the table is not the value's natural written form. In the first two
cases `@ConvertWith` makes the intent explicit and immune to someone else's refactoring; in the
third, the table has stopped being a table of values.

{/* FOOTER */}
