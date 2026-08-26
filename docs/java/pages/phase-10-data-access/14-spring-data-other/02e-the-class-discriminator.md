---
title: "Every document Spring Data writes carries your fully-qualified class name in a `_class` field, which is why renaming a package can stop your application reading its own data"
sidebar_label: "02e · The _class discriminator"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Type mapping* — the
> `MongoTypeMapper`/`DefaultMongoTypeMapper` description, the type-hint rule,
> `@TypeAlias` and its metadata caveat, and `TypeInformationMapper`
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/converters-type-mapping.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/converters-type-mapping.html)),
> and the *Migration guide 4.x to 5.x* for the UUID and BigDecimal representation changes
> ([…/migration-guide/migration-guide-4.x-to-5.x.html](https://docs.spring.io/spring-data/mongodb/reference/migration-guide/migration-guide-4.x-to-5.x.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**Spring Data MongoDB has to solve a problem JPA solves with schema: when it reads a
document back, what Java type should it become? A relational row's type is decided by
the table it came from. A document's is not, because a collection has no schema and
polymorphic values can be anything. Spring Data's answer is to write the answer into the
document — the fully-qualified class name, in a field called `_class`, on every document
and on every nested value whose runtime type is a subtype of the declared one. It works,
it is invisible, and it couples your stored data to your package structure.**

## What actually gets written

The reference is direct about the mechanism:

> the `MappingMongoConverter` uses a `MongoTypeMapper` abstraction with
> `DefaultMongoTypeMapper` as its main implementation. Its default behavior to store the
> fully qualified classname under `_class` inside the document.

So a saved `Order` does not just contain your properties. It contains a
`_class` key holding `com.example.shop.order.Order`. You did not ask for it, no
annotation switched it on, and it is in every document you have ever written through
Spring Data MongoDB.

And it is not only at the top level:

> Type hints are written for top-level documents as well as for every value (if it is a
> complex type and a subtype of the declared property type).

That parenthesis is the whole rule. A property declared as `PaymentMethod` holding a
`CardPayment` gets a `_class` hint on the nested sub-document, because the runtime type
is more specific than the declared one. A property declared as `Address` holding exactly
an `Address` does not, because there is nothing to disambiguate. **The hints appear
precisely where polymorphism exists**, which is efficient and also why they are easy to
overlook until the one place they matter breaks.

## Why it exists — the JPA comparison

JPA has the same problem for a `SINGLE_TABLE` inheritance hierarchy, and solves it with
`@Inheritance`, `@DiscriminatorColumn` and `@DiscriminatorValue`. Three things are
different about the relational version, and all three are in JPA's favour on the day you
refactor:

1. **It is opt-in.** A JPA entity with no hierarchy has no discriminator column at all.
   MongoDB's `_class` is always written, hierarchy or not.
2. **The value is yours.** `@DiscriminatorValue("CARD")` is a short, stable string you
   chose. Spring Data's default is the FQCN — a value derived from where the class
   happens to live in your source tree.
3. **The column is in the schema.** Changing the discriminator values is a migration you
   are forced to write, because the column exists and the DDL is a file. Changing a
   package name is a rename in an IDE that nothing connects to stored data.

That third point is the one that bites, and it deserves its own section.

## The refactoring hazard, stated plainly

Move `Order` from `com.example.shop.order` to `com.example.shop.ordering`. Everything
compiles. Every test that writes and then reads within the same run passes, because both
sides agree on the new name. Then the application meets documents written before the
rename, whose `_class` says `com.example.shop.order.Order`, and the converter is asked
to instantiate a class that no longer exists.

The same applies to renaming the class, to moving it into a different module, and to
extracting it into a shared library with a new package root. **A package rename is a
data migration in this mapping layer.** Nothing in the tooling tells you that.

There are two documented ways to decouple the stored value from the class's location,
and it is worth setting both up before you have data rather than after.

## `@TypeAlias`, and its one real caveat

```java
@Document("people")
@TypeAlias("pers")
public class Person { … }
```

Now `_class` holds `pers` rather than the fully-qualified name. Rename the package, move
the class, split the module — the stored value does not change, and reads keep working.

The caveat is stated in the reference and it is not obvious:

> Type aliases only work if the mapping context is aware of the actual type. The
> required entity metadata is determined either on first save or has to be provided via
> the configurations initial entity set.

Read that carefully. Spring Data can only map `pers` back to `Person` if it *knows*
`Person` exists. It learns that either by having saved one (which has not happened yet
in a fresh process that only ever reads), or by being told up front. So an application
whose first operation after a restart is a **read** of aliased data needs the initial
entity set populated, or the alias resolves to nothing.

```java
@Configuration
class MongoConfig extends AbstractMongoClientConfiguration {

    @Override
    protected String getDatabaseName() { return "shop"; }

    @Override
    protected Collection<String> getMappingBasePackages() {
        return List.of("com.example.shop.model");     // seeds the initial entity set
    }
}
```

Boot's auto-configuration seeds the initial entity set by scanning the auto-configuration
packages for `@Document` types — which is one more reason to actually annotate
`@Document` even though mapping does not require it, as
[02c · Documents and identifiers](02c-documents-and-mapping.md) notes.

## `TypeInformationMapper`, for total control

If neither the FQCN nor a per-class alias is what you want, the mapping from a stored
value to a Java type is a strategy you can replace:

```java
@Bean
MappingMongoConverter mappingMongoConverter(MongoDatabaseFactory factory,
                                            MongoCustomConversions conversions,
                                            MongoMappingContext context) {

    var converter = new MappingMongoConverter(
            new DefaultDbRefResolver(factory), context);

    converter.setTypeMapper(new DefaultMongoTypeMapper(
            DefaultMongoTypeMapper.DEFAULT_TYPE_KEY,
            List.of(new MyTypeInformationMapper())));

    converter.setCustomConversions(conversions);
    return converter;
}
```

`DefaultMongoTypeMapper` takes the type key and a list of `TypeInformationMapper`
implementations; a `TypeInformationMapper` is the thing that turns a Java type into an
alias object and back. `ConfigurableTypeInformationMapper` and
`SimpleTypeInformationMapper` are the built-ins, and `@TypeAlias` is really just a
convenient front end onto the same idea.

⚠️ **Honest limit of what the documentation says.** The type-mapping reference documents
`@TypeAlias` and `TypeInformationMapper` as the customisation points. It does **not**
document a supported way to switch `_class` off entirely — so this page does not claim
one exists. If you want the hint gone, the documented shape of the question is "which
type mapper do I install", not "which flag do I set". Treat any recipe you find online
for suppressing it as unsupported until you have checked it against the version you run.

## Conversions Spring Data MongoDB 5 stopped choosing for you

Two representation defaults were removed in the 4.x → 5.x migration, and both change how
values land in BSON. The migration guide states them outright:

> Spring Data no longer defaults UUID settings … the `UuidRepresentation` has to be set
> explicitly

> Spring Data no longer defaults BigInteger/BigDecimal conversion … the default
> `BigDecimalRepresentation` has to be set explicitly

```java
@Override
protected void configureClientSettings(MongoClientSettings.Builder builder) {
    builder.uuidRepresentation(UuidRepresentation.STANDARD);
}

@Override
protected void configureConverters(MongoConverterConfigurationAdapter adapter) {
    adapter.bigDecimal(BigDecimalRepresentation.DECIMAL128);
}
```

`BigDecimalRepresentation.STRING` retains the pre-5.x behaviour; `DECIMAL128` stores a
real BSON decimal that the server can compare and aggregate on. **These are not
cosmetic.** A `BigDecimal` stored as a string sorts lexicographically, so `"9.00"` is
greater than `"10.00"`, and a `$sum` over it does nothing useful. A collection written
under one representation and read under the other produces values that do not compare
equal to themselves.

Alongside those, the same migration requires MongoDB Java driver **5.6+**, makes
`DefaultMessageListenerContainer` auto-start, and discontinues JMX support.

## Gotchas

**★ `_class` is written to every document whether or not you have a hierarchy.** It is
not a feature you opted into and it is not free storage. On a collection of tiny
documents an FQCN can be a meaningful fraction of each one.

**★ Renaming or moving a document class breaks reads of existing data.** The stored
FQCN no longer resolves. Nothing warns you at build time, and the tests pass because
they write and read within one process.

**★ `@TypeAlias` added *after* you have data does not retrofit anything.** Existing
documents still hold the FQCN; new ones hold the alias. You now have two discriminator
values for one type, and only one of them resolves once the class moves.

**★ An alias only resolves if the mapping context knows the type.** A read-only service
that restarts and immediately reads aliased documents has never saved one, so unless the
initial entity set is seeded the alias maps to nothing.

**★ Type hints appear on nested values only when the runtime type is a subtype of the
declared type.** So a hierarchy that starts out non-polymorphic gets no hints, and
introducing the first subclass changes what future documents look like while leaving
every historical document ambiguous.

**★ Declaring a property as `Object` or as a raw collection makes every value carry a
hint.** It works, and it embeds your class names in a lot of documents.

**★ A polymorphic field read into a *narrower* declared type silently fails to
disambiguate.** If the declared type is already the concrete class, the hint is not
written, and later widening the declaration cannot recover type information that was
never stored.

**★ `BigDecimal` stored as a string does not sort or aggregate numerically.** This is
the pre-5.x default and it is still selectable. If a report ever sums a monetary field
on the server, `DECIMAL128` is the only correct choice.

**★ Upgrading to Spring Data MongoDB 5 without setting `uuidRepresentation` changes how
UUIDs are written.** The old implicit default is gone; mixed representations in one
collection means equality lookups miss.

**★ `_class` is a real field, so a hand-written `@Query` can match on it — and people
do.** That works and it hard-codes a class name into a query string, which is now a
second place the refactor has to reach.

**★ Two applications sharing a collection must agree on the discriminator.** A Node
service writing documents with no `_class`, or a second Java service with different
package names, produces documents the other side cannot map. Aliases are the only sane
contract there.

## Interview questions

**★ What is the `_class` field in a Spring Data MongoDB document?**
A type hint. `MappingMongoConverter` delegates to a `MongoTypeMapper`, whose default
implementation `DefaultMongoTypeMapper` stores the fully-qualified class name under
`_class` so the converter knows what to instantiate on read.

**★ Why does a document store need that and a relational database does not?**
Because a table has a schema and a collection does not. A row's type is decided by the
table it came from; a document's has to be recorded in the document, especially for
polymorphic nested values where the declared property type is not the runtime type.

**★ On which values is the hint written?**
On every top-level document, and on any nested value whose type is complex *and* a
subtype of the declared property type. Where the declared type is already exact, no hint
is written.

**★ You move a document class to a new package and old data stops loading. Why, and
what is the fix?**
Existing documents hold the old FQCN in `_class`, and it no longer resolves. The fix
going forward is `@TypeAlias` with a stable value; the fix for the data you already have
is a backfill that rewrites `_class`, because nothing does it for you.

**★ What is the catch with `@TypeAlias`?**
The mapping context must know the type before it can resolve the alias. It learns that
on first save, or from the initial entity set. A service that reads before it ever
writes needs the entity set seeded, typically by scanning a base package.

**★ How does this compare to JPA's `@DiscriminatorColumn`?**
JPA's is opt-in, per-hierarchy, holds a value you chose, and lives in a schema that
forces a migration when it changes. MongoDB's is always on, applies to every document,
defaults to a value derived from your package structure, and changes silently.

**★ Can you turn `_class` off?**
The type-mapping reference documents `@TypeAlias` and replacing the
`TypeInformationMapper` as the customisation points; it does not document a supported
switch that removes the hint entirely. The supportable answer is to control the *value*
rather than try to remove the field.

**★ Why did Spring Data MongoDB 5 stop defaulting the `BigDecimal` representation?**
Because the two representations are not interchangeable and the old implicit default was
the wrong one for anything numeric. String-stored decimals sort lexicographically and
cannot be aggregated server-side; `DECIMAL128` can. Forcing an explicit choice makes the
consequence visible at configuration time rather than at report time.

**★ Two services, one Java and one Node, share a collection. What does `_class` do to
that arrangement?**
The Node service writes documents with no hint, and may write shapes the Java converter
cannot resolve for polymorphic fields. If the collection is genuinely shared, the
discriminator has to become part of the agreed contract — a short, stable alias both
sides understand — rather than an implementation detail of one framework.

{/* FOOTER */}
