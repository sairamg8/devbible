---
title: "The infrastructure finds your fragment implementation by scanning below the package it found the repository in and matching a postfix, which is why a fragment in the wrong package fails at first call rather than at startup — and why there is a spring.factories escape for fragments that ship in a jar"
sidebar_label: "08b · Finding the implementation"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "Custom Repository
> Implementations", the *Configuration*, *Resolution of Ambiguity*, *Manual Wiring* and
> *Registering Fragments with spring.factories* sections
> ([repositories/custom-implementations.html](https://docs.spring.io/spring-data/jpa/reference/repositories/custom-implementations.html))
> — plus the `RepositoryFactorySupport` and `RepositoryComposition` source
> ([spring-data-commons](https://github.com/spring-projects/spring-data-commons/blob/main/src/main/java/org/springframework/data/repository/core/support/RepositoryFactorySupport.java)).
> JDK 25, Spring Boot 4.1.1, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**[08](08-custom-implementations.md) established the three types and the `Impl` rule. This
chunk is the discovery mechanism behind it — where the scan looks, how the postfix is
configured, what happens when two classes match, and the two escape hatches for fragments
the scan cannot reach.**

## Where the scan looks

> *"The repository infrastructure tries to autodetect custom implementation fragments by
> scanning for classes below the package in which it found a repository. These classes
> need to follow the naming convention of appending a postfix defaulting to `Impl`."*

Two conditions, both necessary: **below the package where a repository was found**, and
**the right postfix**. A fragment implementation in a sibling package — `com.acme.impl`
next to `com.acme.repository` — is simply not seen.

That is the single most common way this feature fails, and it usually arrives with a
refactor that tidied implementations into their own package.

### What happens when it is not found

This one is genuinely good news, and it is worth knowing precisely because the folklore
says otherwise. `RepositoryFactorySupport` validates the composition while building the
repository, and there are two distinct failures, both at bootstrap:

```java
if (repositoryInformation.hasCustomMethod()) {

    if (composition.isEmpty()) {
        throw new IncompleteRepositoryCompositionException(
            String.format("You have custom methods in %s but have not provided a custom implementation",
                    ClassUtils.getQualifiedName(repositoryInterface)), repositoryInterface);
    }

    composition.validateImplementation();
}
```

and `validateImplementation()` walks every fragment:

```java
fragments.stream().forEach(it -> it.getImplementation()
        .orElseThrow(() -> new FragmentNotImplementedException(
                String.format("Fragment %s used in %s has no implementation",
                        ClassUtils.getQualifiedName(it.getSignatureContributor()),
                        ClassUtils.getQualifiedName(repositoryInterface)),
                repositoryInterface, it)));
```

So the two messages to recognise are **"You have custom methods in … but have not provided
a custom implementation"** and **"Fragment … used in … has no implementation"**. Both name
the repository interface, and the second names the fragment. A misplaced or misnamed
`…Impl` class is a startup failure, not a lurking runtime one — which puts fragment
resolution in the same category as a mistyped derived-query property
([03f](03f-what-is-checked-and-when.md)) rather than in the category of a native query.

A third, related failure covers the built-in executor interfaces:
`UnsupportedFragmentException` — *"Repository %s implements %s but %s does not support %s"*
— raised when a repository extends a well-known executor interface the module cannot provide.

## Configuring the postfix

```java
@EnableJpaRepositories(repositoryImplementationPostfix = "MyPostfix")
class Configuration { … }
```

> *"The first configuration in the preceding example tries to look up a class called
> `com.acme.repository.CustomizedUserRepositoryImpl` to act as a custom repository
> implementation. The second example tries to look up
> `com.acme.repository.CustomizedUserRepositoryMyPostfix`."*

⚠️ Changing the postfix changes it **for every fragment in that configuration's scope**.
It is a project-wide decision, and in a Spring Boot application you rarely declare
`@EnableJpaRepositories` at all — auto-configuration does it, with the default postfix.
The moment you add the annotation to change one thing, you take over repository
configuration wholesale, including the base packages.

## When two classes match

> *"If multiple implementations with matching class names are found in different
> packages, Spring Data uses the bean names to identify which one to use."*

> *"Given the following two custom implementations for the `CustomizedUserRepository`
> shown earlier, the first implementation is used. Its bean name is
> `customizedUserRepositoryImpl`, which matches that of the fragment interface
> (`CustomizedUserRepository`) plus the postfix `Impl`."*

```java
class CustomizedUserRepositoryImpl implements CustomizedUserRepository {
  // Your custom implementation
}
```

```java
@Component("specialCustomImpl")
class CustomizedUserRepositoryImpl implements CustomizedUserRepository {
  // Your custom implementation
}
```

The tie-break is the **bean name**, not the package, not the class name, not the order of
scanning. The default bean name for a scanned component is the decapitalised simple class
name, which is why the unannotated one wins: `customizedUserRepositoryImpl` is exactly
"fragment interface name, decapitalised, plus postfix".

The practical reading: `@Component("someOtherName")` on a fragment implementation removes
it from consideration as *the* implementation of that fragment. That is either a
deliberate way to keep two implementations apart or an accidental way to disable one —
and the symptom of the accident is a method that fails at call time in one environment.

## Manual wiring

> *"If your custom implementation uses annotation-based configuration and autowiring
> only, the preceding approach shown works well, because it is treated as any other
> Spring bean. If your implementation fragment bean needs special wiring, you can declare
> the bean and name it according to the conventions described in the preceding section.
> The infrastructure then refers to the manually defined bean definition by name instead
> of creating one itself."*

So a `@Bean` method producing the fragment works, provided the bean *name* follows the
convention. Name the `@Bean` method after the convention or set the name explicitly; a
`@Bean` method called `orderSearch` does not satisfy a fragment looking for
`orderSearchImpl`.

## Fragments that live outside the scan: `spring.factories`

> *"As already mentioned in the Configuration section, the infrastructure only
> auto-detects fragments within the repository base-package. Therefore, fragments
> residing in another location or want to be contributed by an external archive will not
> be found if they do not share a common namespace. Registering fragments within
> `spring.factories` allows you to circumvent this restriction."*

The registration is one line in `META-INF/spring.factories`, keyed by the fragment
interface:

```
com.acme.search.SearchExtension=com.acme.search.DefaultSearchExtension
```

and then the fragment is added to a repository like any other:

```java
interface MovieRepository extends CrudRepository<Movie, String>, SearchExtension<Movie> {
}
```

This is how a shared library ships a capability — a full-text search, a tenancy filter, a
soft-delete convention — that every repository in an organisation can opt into by adding
one interface to an `extends` list. It is the fragment mechanism's real ceiling, and it
is worth knowing exists before writing an abstract base repository instead.

## A fragment that needs to know which repository it is in

A generic fragment has a problem: `DefaultSearchExtension<T>` does not know what `T` is at
run time. Spring Data exposes the invocation metadata for exactly this:

```java
class DefaultSearchExtension<T> implements SearchExtension<T> {

    @Override
    public List<T> search(String text, Limit limit) {
        return search(RepositoryMethodContext.getContext(), text, limit);
    }

    List<T> search(RepositoryMethodContext metadata, String text, Limit limit) {
        Class<T> domainType = metadata.getRepository().getDomainType();
        String indexName = domainType.getSimpleName().toLowerCase();
        …
    }
}
```

> *"`RepositoryMethodContext.getContext()` is used to retrieve metadata for the actual
> method invocation. `RepositoryMethodContext` exposes information attached to the
> repository such as the domain type."*

🔴 **It is off by default, and the reference says why:**

> *"Exposing invocation metadata is costly, hence it is disabled by default. To access
> `RepositoryMethodContext.getContext()` you need to advise the repository factory
> responsible for creating the actual repository to expose method metadata."*

Two ways to turn it on. The targeted one is a marker interface on the fragment
implementation:

> *"Adding the `RepositoryMetadataAccess` marker interface to the fragments
> implementation will trigger the infrastructure and enable metadata exposure for those
> repositories using the fragment."*

```java
class DefaultSearchExtension<T> implements SearchExtension<T>, RepositoryMetadataAccess {
  // ...
}
```

The blunt one is a `BeanPostProcessor` setting `setExposeMetadata(true)` on every
`RepositoryFactoryBeanSupport`, which the reference itself warns against:

> *"Please do not just copy/paste the above but consider your actual use case which may
> require a more fine-grained approach as the above will simply enable the flag on every
> repository."*

Prefer the marker interface: it enables the cost only for repositories that use the
fragment.

## Gotchas

**★ The scan only looks *below* the package where a repository was found.** A fragment
implementation in a sibling package is invisible, and the repository fails to be created.

**★ Learn the two exception messages.** `IncompleteRepositoryCompositionException` — "You
have custom methods in … but have not provided a custom implementation" — means nothing at
all was found. `FragmentNotImplementedException` — "Fragment … used in … has no
implementation" — names the specific fragment that is missing its class. Both are bootstrap
failures.

**★ The tie-break between two matching classes is the bean name.** The default bean name
of a scanned component is the decapitalised class name; an explicit `@Component("name")`
that does not match "fragment interface plus postfix" takes that class out of the running.

**★ A manually declared `@Bean` fragment must be named by the convention.** Method name or
explicit bean name — the infrastructure looks it up by name, not by type.

**★ Changing `repositoryImplementationPostfix` is project-wide.** And in a Boot
application, adding `@EnableJpaRepositories` to change it also takes over base-package
configuration that auto-configuration was doing for you.

**★ `RepositoryMethodContext.getContext()` returns nothing useful unless metadata exposure
is on.** The reference calls the exposure costly and disables it by default; enabling it
globally through a `BeanPostProcessor` pays that cost on every repository.

**★ `spring.factories` registration is keyed by the fragment interface.** One line, one
fragment, both names fully qualified. A typo means the fragment is not registered, and you
are back to `FragmentNotImplementedException` at startup.

**★ A library-provided fragment still has to be added to each repository's `extends`
list.** `spring.factories` makes it *findable*, not automatic.

**★ Two repositories extending the same fragment share one implementation bean.** It is a
singleton like any other bean, so per-repository state inside a fragment implementation is
a bug waiting for the second repository to adopt it.

## Interview questions

**★ How does Spring Data find the implementation of a fragment interface?**
By scanning for classes below the package in which it found a repository, matching the
fragment interface name plus an implementation postfix that defaults to `Impl`.

**★ You moved all your `…Impl` classes into an `impl` sub-package and everything still
works. You moved them into a sibling package and it broke. Why?**
The scan looks below the repository's package. A sub-package is below it; a sibling is
not, so the fragment is never found — and the failure surfaces only when the method is
called.

**★ Two classes named `CustomizedUserRepositoryImpl` exist in different packages. Which is
used?**
The one whose bean name matches the fragment interface name plus the postfix. Bean names
are the documented tie-break, so an explicitly named `@Component` loses to a conventionally
named one.

**★ How do you contribute a repository fragment from a library jar?**
Register it in `META-INF/spring.factories` keyed by the fragment interface, since the
auto-detection only covers the repository base package. Repositories then opt in by
extending the fragment interface.

**★ A generic fragment needs the domain type of the repository it was mixed into. How?**
`RepositoryMethodContext.getContext()` exposes the invocation metadata, including the
repository's domain type — but exposure is disabled by default because it is costly.
Implement `RepositoryMetadataAccess` on the fragment to enable it just for repositories
using that fragment.

**★ Why not just enable metadata exposure globally?**
Because it applies the cost to every repository in the application. The reference
explicitly warns against copying the `BeanPostProcessor` approach without considering
scope.

**★ What is the failure mode of a mistyped fragment implementation class name?**
A bootstrap failure. The composition is validated when the repository is created:
`FragmentNotImplementedException` if a specific fragment has no implementation, or
`IncompleteRepositoryCompositionException` if the repository declares custom methods and
the composition is empty.

{/* FOOTER */}
