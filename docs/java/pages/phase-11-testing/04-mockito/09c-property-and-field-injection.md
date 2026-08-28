---
title: "The second injection strategy instantiates the object with a no-arg constructor, walks its class hierarchy, skips every final and static field, sorts what is left by name with supertypes pushed to the back, and then runs a three-filter chain that consults the mock's NAME only when more than one candidate survives the type filter — and unlike constructor injection, it throws when it cannot decide"
sidebar_label: "09c · Property and field injection"
sidebar_position: 38
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc and the bodies of `PropertyAndSetterInjection`, `TypeBasedCandidateFilter`,
> `NameBasedCandidateFilter`, `TerminalMockCandidateFilter`, `SuperTypesLastSorter`,
> `SpyOnInjectedFieldsHandler` and `Reporter` under
> `mockito-core/src/main/java/org/mockito/internal/`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — every exception string on this page
> is assembled from `Reporter`'s own source, never from a console.

**Strategy 2 runs whenever [09b · Constructor injection](09b-constructor-injection.md) declined —
which is any class with a no-arg constructor, and any class whose `@InjectMocks` field you
initialised yourself. It is the strategy the javadoc splits into "property setter" and "field".
This chunk is what object it builds and which of that object's fields it will even look at — the
`final`-fields rule alone explains most reports of "`@InjectMocks` stopped working". How it then
chooses between candidate mocks, and where it throws rather than shrugging, is
[09d · The candidate filters](09d-the-candidate-filters.md).**

## The algorithm, in Mockito's own words

`PropertyAndSetterInjection`'s class comment is the specification, and it is worth quoting whole
because every later section is one line of it:

> *"Inject mocks using first setters then fields, if no setters available."*
>
> *"for each field annotated by @InjectMocks — initialize field annotated by @InjectMocks — for
> each fields of a class in @InjectMocks type hierarchy — make a copy of mock candidates — order
> fields from sub-type to super-type, then by field name — for the list of fields in a class try
> two passes of: find mock candidate by type; if more than **one** candidate find mock candidate
> on name; if one mock candidate then set mock by property setter if possible else set mock by
> field injection; remove mock from mocks copy (mocks are just injected once in a class); remove
> injected field from list of class fields — else don't fail, user will then provide
> dependencies"*

## 🔴 Step 0 — instantiation, and the one place `@InjectMocks` reliably explodes

Before any field is touched, the strategy makes sure there is an object:

```java
private FieldInitializationReport initializeInjectMocksField(Field field, Object fieldOwner) {
    try {
        return new FieldInitializer(fieldOwner, field).initialize();
    } catch (MockitoException e) {
        if (e.getCause() instanceof InvocationTargetException) {
            throw fieldInitialisationThrewException(field, e.getCause().getCause());
        }
        throw cannotInitializeForInjectMocksAnnotation(field.getName(), e.getMessage());
    }
}
```

Note what is missing: there is no `return false`. **Strategy 2 does not decline — it throws.**
`FieldInitializer` here uses the *no-arg* instantiator, so a class with only a parameterised
constructor that strategy 1 could not satisfy arrives at:

```text
Cannot instantiate @InjectMocks field named 'manager'! Cause: the type 'ArticleManager' has no default constructor
You haven't provided the instance at field declaration so I tried to construct the instance.
Examples of correct usage of @InjectMocks:
   @InjectMocks Service service = new Service();
   @InjectMocks Service service;
   //and... don't forget about some @Mocks for injection :)
```

This is the single most useful thing to know about `@InjectMocks` failure modes: **a `null`
collaborator means constructor injection succeeded and passed `null`; a `MockitoException` means
constructor injection declined and there was no no-arg constructor.** Two completely different
diagnoses that people treat as one.

## The hierarchy walk, and "once per class"

```java
Class<?> fieldClass = report.fieldClass();
while (fieldClass != Object.class) {
    injectionOccurred |= injectMockCandidates(
            fieldClass, fieldInstance, injectMocksField,
            newMockSafeHashSet(mockCandidates));      // a FRESH COPY per class
    fieldClass = fieldClass.getSuperclass();
}
```

The copy is taken per class level, and the "mocks are just injected once in a class" rule operates
on that copy. So **the same mock can be injected into a field of the subclass *and* a field of the
superclass.** A SUT that inherits a `protected Clock clock` and also declares its own `Clock clock`
gets the same mock in both, and a test that counts interactions on it sees the sum.

## Which fields are eligible, and in what order

```java
return sortSuperTypesLast(
        Arrays.stream(awaitingInjectionClazz.getDeclaredFields())
                .filter(field -> !Modifier.isFinal(field.getModifiers())
                              && !Modifier.isStatic(field.getModifiers()))
                .collect(Collectors.toList()));
```

🔴 **`final` and `static` fields are skipped entirely** — which the javadoc also states: *"However
fields that are static or final will be ignored."* Read that against modern Java style. A SUT
written the way everyone recommends, with `private final` collaborators and a constructor, is
**invisible to strategy 2**. If constructor injection did not satisfy it, nothing will, and the
fields stay `null` with no message. This is the most common reason `@InjectMocks` "stops working"
after someone adds `final` to the fields.

The ordering is `SuperTypesLastSorter`: sort by **field name**, then move any field whose type is a
supertype of a later field's type after it. The effect is that the most specific field gets first
claim on a mock, and a `Collaborator`-or-`Object`-typed catch-all field is filled last.


## Gotchas

**★ Adding `final` to the SUT's collaborator fields and watching injection stop.**
Strategy 2 filters out `final` and `static` fields before it looks at anything else, and the
javadoc agrees: *"fields that are static or final will be ignored."* If the constructor cannot be
satisfied, nothing is injected and nothing is reported.

**★ Two `@InjectMocks` fields sharing a mock and one of them seeing extra interactions.**
The mock candidate set is copied per class level, not consumed globally, so the same mock can be
injected in several places. Counting interactions across them sums.

**★ A field in a superclass of the SUT getting the same mock as one in the subclass.**
Same mechanism, one level down. `verify(mock, times(1))` then fails because both fields used it.

**★ `@InjectMocks` on a field you initialised, expecting your wiring to survive.**
Constructor injection declines for an already-initialised field, so strategy 2 runs and overwrites
any non-final field it can match. Real collaborators you passed deliberately are replaced by mocks.

**★ Making the collaborator fields `final` to protect them from that.**
It works — and it also means that if constructor injection ever declines, nothing is injected at
all. Both effects come from the same `filter`.

**★ Relying on field order because it "looks alphabetical".**
It is alphabetical *and then* rearranged so supertype-typed fields sink to the back. With a
`Collaborator base` and a `SpecificCollaborator specific` field, the second is filled first.

## Interview questions

**★ When does strategy 2 run at all?**
When constructor injection returned `false` — which happens when the biggest constructor has no
parameters, when a primitive parameter could not be resolved, or when the `@InjectMocks` field was
already initialised. For a class with a single parameterised constructor and all collaborators
mocked, strategy 2 never runs.

**★ Why does `@InjectMocks` stop injecting when I make the SUT's fields `final`?**
Because `orderedInstanceFieldsFrom` filters out `final` and `static` fields before any matching
happens. Constructor injection still works, so a class with a parameterised constructor is
unaffected — but a class relying on field injection is silently no longer wired.

**★ Your test fails with `MockitoException: Cannot instantiate @InjectMocks field named 'x'!` What
does that tell you that a `null` field would not?**
That constructor injection *declined* — it could not satisfy the biggest constructor — and the
class has no no-arg constructor for strategy 2 to fall back on. A `null` field means the opposite:
construction succeeded and `null` was passed for a parameter. The first is a wiring problem in the
test; the second is usually a missing `@Mock`.

{/* FOOTER */}
