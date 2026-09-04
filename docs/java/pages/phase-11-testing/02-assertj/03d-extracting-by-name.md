---
title: "Extracting by name compiles no matter what you rename, returns ObjectAssert of Object, and reads private fields by default, which is why the Function overloads are the ones you reach for"
sidebar_label: "03d · Extracting by name"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the AssertJ Core documentation — "Extracting elements values"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-group-extracting)) —
> and the `assertj-core` 3.27.7 sources (`AbstractIterableAssert.extracting(String)`,
> `AbstractObjectAssert.extracting`, `PropertyOrFieldSupport.getSimpleValue`,
> `org.assertj.core.configuration.Configuration.ALLOW_EXTRACTING_PRIVATE_FIELDS` and
> `BARE_NAME_PROPERTY_EXTRACTION_ENABLED`).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Every `extracting` overload in [03c](03c-extracting.md) has a `String`-named twin that
looks tidier at the call site and costs you three things: the compiler's check, the element
type, and the class's encapsulation. This chunk is those three costs, the exact resolution
order AssertJ uses to turn `"race.name"` into a value, and the single-object form of the
same idea.**

## The `String` overloads, and their three costs

```java
// "name" needs to be either a property or a field of the TolkienCharacter class
assertThat(fellowshipOfTheRing).extracting("name")
                               .contains("Boromir", "Gandalf", "Frodo", "Legolas")
                               .doesNotContain("Sauron", "Elrond");

// specifying nested field/property is supported
assertThat(fellowshipOfTheRing).extracting("race.name")
                               .contains("Man", "Maia", "Hobbit", "Elf");
```

**Cost one: no compile-time check.** Rename `name` to `fullName` in the IDE and the lambda
form fails to compile while the string form keeps compiling and starts failing at runtime
with an introspection error. A field name in a string is a name your refactoring tool cannot
see.

**Cost two: the result is untyped.** In 3.27.7 the signature is:

```java
public AbstractListAssert<?, List<? extends Object>, Object, ObjectAssert<Object>> extracting(String propertyOrField)
```

`Object` elements, `ObjectAssert` navigation. So none of the String-specific or
number-specific assertions is reachable afterwards — `extracting("name").allMatch(...)`
gives you `Object` in the lambda. The documented fix is the two-argument form:

```java
// to have type safe extracting, use the second parameter to pass the expected property type:
assertThat(fellowshipOfTheRing).extracting("name", String.class)
                               .contains("Boromir", "Gandalf", "Frodo", "Legolas")
                               .doesNotContain("Sauron", "Elrond");
```

which returns `AbstractListAssert<?, List<? extends P>, P, ObjectAssert<P>>` — typed
elements, though still `ObjectAssert` on navigation.

**Cost three: it reads encapsulated state.** The documentation:

> *"Extracting by name can access private fields/properties which is handy to check
> internals not exposed with public methods (lambda won't work here)"*

and

> *"Reading private fields is supported by default, but can be disabled globally by calling
> `Assertions.setAllowExtractingPrivateFields(false)`."*

This is genuinely useful once a year and a liability the rest of the time: a test that
asserts on a private field is coupled to the implementation, will not be caught by a
refactoring, and quietly documents an invariant the class does not actually publish.

## How the name is resolved, exactly

`PropertyOrFieldSupport.getSimpleValue` tries, in order: **property getter → field →
map key**:

```java
try {
  // try to get name as a property
  return propertySupport.propertyValueOf(name, Object.class, input);
} catch (IntrospectionError propertyIntrospectionError) {
  // try to get name as a field
  try {
    return fieldSupport.fieldValue(name, Object.class, input);
  } catch (IntrospectionError fieldIntrospectionError) {
    // if input is a map, try to use the name value as a map key
```

Two consequences. A class with both a field `total` and a getter `getTotal()` that computes
something different will report the **getter's** value, which is the right default and a
surprise when the two disagree. And a `Map` element supports `extracting("someKey")` — handy
for asserting on deserialised JSON, and a source of confusion when a key happens to share a
name with a `Map` property.

Records work because their accessors are bare-named (`name()`), and bare-name property
methods are enabled by default: `Configuration.BARE_NAME_PROPERTY_EXTRACTION_ENABLED = true`
in 3.27.7, described in the docs as *"Globally sets whether the AssertJ extracting capability
considers bare-named property methods like `String name()`. Defaults to true."*

## `extracting` on a single object

The same idea exists on `AbstractObjectAssert`, and its overloads mirror the iterable ones —
`extracting(String)` returns another `AbstractObjectAssert`, the varargs forms return a list
assert, and there is a form taking an `InstanceOfAssertFactory` to keep the type:

```java
assertThat(order).extracting(Order::reference, as(InstanceOfAssertFactories.STRING))
                 .startsWith("ORD-");
```

`returns(expected, from)` is the compact alternative when you just want one value equal to
one expected value: `assertThat(order).returns("ORD-1", Order::reference)`. It reads
backwards the first time and it keeps the whole chain on the original object, which is often
what you want.

## Gotchas

**★ `extracting("field")` is not checked by the compiler or by your IDE's rename.**
A refactor silently breaks it and it fails at runtime with an introspection error rather
than at build time. Prefer the method-reference forms in any code that will be maintained.

**★ `extracting(String)` returns `Object` elements and `ObjectAssert` navigation.**
The signature is literally
`AbstractListAssert<?, List<? extends Object>, Object, ObjectAssert<Object>>`. No
String-specific assertions afterwards. Use `extracting("name", String.class)` or a method
reference.

**★ Extracting by name reads private fields by default.**
`AllowExtractingPrivateFields` defaults to `true`. A test can assert on state the class does
not publish, which couples the test to the implementation and survives no refactor. Consider
setting it to `false` project-wide and requiring a deliberate exception.

**★ `extracting` on a nested path returns `null` for the whole path when any intermediate is
`null`.**
The docs state it for filtering and the same resolution is used here: *"if an intermediate
value is null the whole nested property/field is considered to be null, for example reading
`"address.street.name"` will return null if `"address.street"` is null."* So a broken
association shows up as a `null` in the extracted list, not as an error.

**★ The property getter wins over the field of the same name.**
`getSimpleValue` tries the getter first. A computed getter that does not simply return the
field will be what your assertion sees.

**★ `extracting` on a `Map` element falls through to a key lookup.**
Convenient for deserialised JSON, surprising when a key collides with something introspection
resolves first.

## Interview questions

**★ Why prefer `extracting(Order::reference)` over `extracting("reference")`?**
Three reasons, in decreasing order of importance. The method reference is checked by the
compiler, so a rename either updates it or breaks the build; the string is invisible to
refactoring and fails at runtime. The method reference form preserves the element type, so
subsequent assertions stay type-specific, whereas `extracting(String)` returns
`ObjectAssert<Object>`. And the method reference can only reach what the class publishes,
while the string form reads private fields by default.

**★ When is `extracting("someField")` actually the better choice?**
When there is no accessor — asserting on a private field's value during a targeted white-box
test, or extracting from a heterogeneous structure like a deserialised `Map` where no typed
accessor exists. The documentation acknowledges the first case explicitly: extracting by
name *"can access private fields/properties which is handy to check internals not exposed
with public methods (lambda won't work here)"*. Treat it as a deliberate exception, not a
default.

**★ How does AssertJ resolve the string `"race.name"` against an element?**
It splits on the dot and resolves each segment with `getSimpleValue`, which tries a property
getter first (`getX()` or `isX()`, and a bare-named `x()` since bare-name extraction defaults
to enabled), then a field of that name, then — if the object is a `Map` — a key of that name.
If any intermediate value is `null`, the whole path evaluates to `null` rather than throwing.

{/* FOOTER */}
