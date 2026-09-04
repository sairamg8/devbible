---
title: "Module detection has a documented default, a documented alternative, a programmatic escape hatch and a stale default value in the appendix — and if your packages do not match the convention, the detection strategy is the first thing to change rather than the package tree"
sidebar_label: "11h · Module detection"
sidebar_position: 34
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Spring Modulith reference, *Fundamentals* — "Customizing
> the Application Modules Arrangement", "Customizing Module Detection" and "Contributing
> Application Modules From Other Packages"
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/fundamentals.html)) —
> and *Appendix B: Spring Modulith Configuration Properties*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/appendix.html)).
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith **2.1.1**. **No sandbox.**

**The default convention — direct sub-packages of the main package — fits a greenfield
project and almost no existing one. Rather than reorganising a large package tree on day
one, change how modules are detected. There are three levels of escape hatch, and one
documentation inconsistency worth knowing about before it confuses you.**

## Level 1 — `@Modulithic` on the application class

> *"Spring Modulith allows to configure some core aspects around the application module
> arrangement you create via the `@Modulithic` annotation to be used on the main Spring Boot
> application class."*

```java
package com.acme.commerce;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

@Modulithic(
    systemName = "ACME Commerce",
    sharedModules = "shared",
    additionalPackages = "com.acme.integrations"
)
@SpringBootApplication
class CommerceApplication {

    public static void main(String... args) {
        SpringApplication.run(CommerceApplication.class, args);
    }
}
```

The three attributes, verbatim:

> *"systemName | The human readable name of the application to be used in generated
> documentation."*
>
> *"sharedModules | Declares the application modules with the given names as shared modules,
> which means that they will always be included in application module integration tests."*
>
> *"additionalPackages | Instructs Spring Modulith to treat the configured packages as
> additional root application packages. In other words, application module detection will be
> triggered for those as well."*

`sharedModules` is the one with day-to-day consequences: it changes what
`@ApplicationModuleTest` bootstraps, so a module that every test needs — configuration,
security, a clock — can be declared once instead of being mocked in every test.
**40 · Bootstrap modes** *(not written yet)* covers the interaction.

`additionalPackages` matters when your code does not all live under the application class's
package — a common shape when integrations or generated adapters sit in a sibling package
tree.

## Level 2 — the detection strategy property

> *"By default, application modules will be expected to be located in direct sub-packages of
> the package the Spring Boot application class resides in. An alternative detection strategy
> can be activated to only consider packages explicitly annotated, either via Spring
> Modulith's `@ApplicationModule` or jMolecules `@Module` annotation. That strategy can be
> activated by configuring the `spring.modulith.detection-strategy` to `explicitly-annotated`."*

```properties
spring.modulith.detection-strategy=explicitly-annotated
```

**This is the setting that rescues an existing codebase.** If your feature packages are at
`com.acme.commerce.core.ordering` rather than `com.acme.commerce.ordering`, the default
strategy sees one module called `core`. Switching to `explicitly-annotated` and putting
`@ApplicationModule` on each real feature package models the architecture you actually have,
without moving a single class.

⚠️ **A documentation inconsistency to be aware of.** Appendix B lists the property's default
value as `none`, while the prose in *Fundamentals* describes `direct-subpackages` as the
behaviour *"which is also the final fallback if nothing is configured"*. Both are consistent
if you read `none` as "no strategy explicitly configured" and `direct-subpackages` as the
resulting behaviour, but the appendix's `none` is easy to misread as "no modules detected".
The observable behaviour is the one the prose describes: leave it unset and direct
sub-packages are modules. If you need certainty for a specific version, print the model.

The property also accepts a class name:

> *"Can either be the class name of a custom implementation of
> `ApplicationModuleDetectionStrategy` or `direct-subpackages` … or `explicitly-annotated` to
> only select packages explicitly annotated with `@ApplicationModule` or jMolecules'
> `@Module`."*

## Level 3 — a custom `ApplicationModuleDetectionStrategy`

> *"If neither the default application module detection strategy nor the manually annotated
> one works for your application, the detection of the modules can be customized by providing
> an implementation of `ApplicationModuleDetectionStrategy`. That interface exposes a single
> method `Stream<JavaPackage> getModuleBasePackages(JavaPackage)` and will be called with the
> package the Spring Boot application class resides in. You can then inspect the packages
> residing within that and select the ones to be considered application module base packages
> based on a naming convention or the like."*

```properties
spring.modulith.detection-strategy=com.acme.commerce.CustomApplicationModuleDetectionStrategy
```

The same interface also carries `detectNamedInterfaces(…)` — see
[30 · Named interfaces](11d-named-interfaces.md).

## 🔴 The rule that catches everybody: where the customisation must live

> *"If you are implementing the `ApplicationModuleDetectionStrategy` interface to customize the
> verification and documentation of modules, include the customization and its registration in
> your application's test sources. However, if you are using Spring Modulith runtime
> components (such as the `ApplicationModuleInitializers`, or the production-ready features like
> the actuator and observability support), you need to explicitly declare the following as a
> compile-time dependency"*

```xml
<dependency>
  <groupId>org.springframework.modulith</groupId>
  <artifactId>spring-modulith-core</artifactId>
</dependency>
```

And the same warning appears at the top of both *Runtime Support* and *Production-ready
Features*:

> *"If you are applying customizations to the application module detection described here, you
> need to move those into your production sources, unless already present there, to make sure
> that those are considered by the features described here."*

**A custom strategy in test sources gives you a verification that checks one module model and
a runtime that uses a different one.** The actuator reports a different graph from the one
your test enforces, and neither is wrong — they were built from different code. Move the
strategy and the property into production sources the moment you enable any runtime feature.

## Contributing modules from other packages

> *"While `@Modulithic` allows defining `additionalPackages` to trigger application module
> detection for packages other than the one of the annotated class, its usage requires knowing
> about those in advance. As of version 1.3, Spring Modulith supports external contributions of
> application modules via the `ApplicationModuleSource` and `ApplicationModuleSourceFactory`
> abstractions. An implementation of the latter can be registered in a spring.factories file
> located in META-INF."*

```
org.springframework.modulith.core.ApplicationModuleSourceFactory=example.CustomApplicationModuleSourceFactory
```

> ```java
> public class CustomApplicationModuleSourceFactory implements ApplicationModuleSourceFactory {
>
>  @Override
>  public List<String> getRootPackages() {
>  return List.of("com.acme.toscan");
>  }
>
>  @Override
>  public ApplicationModuleDetectionStrategy getApplicationModuleDetectionStrategy() {
>  return ApplicationModuleDetectionStrategy.explicitlyAnnotated();
>  }
>
>  @Override
>  public List<String> getModuleBasePackages() {
>  return List.of("com.acme.module");
>  }
> }
> ```

This is the mechanism for a **library** that wants to contribute modules to any application
that includes it — an internal platform starter, for instance — without the application
having to know its package names.

## Gotchas

**★ If your feature packages are not direct sub-packages of the application class's package,
default detection finds one module and enforces nothing.** An intermediate `core`, `domain`
or `app` package collapses the whole architecture into a single module while verification
passes. `explicitly-annotated` fixes it without moving a class, and printing the model
reveals it in seconds.

**★ A detection customisation in test sources produces a different model at runtime, and both
appear to work.** The reference warns about this in three separate places. Verification
enforces one graph while the actuator, observability and module initialisers use another. If
you use any runtime feature, the strategy and its registration must be in production sources
with `spring-modulith-core` as a compile-time dependency.

**★ The appendix's stated default for `spring.modulith.detection-strategy` is `none`, which
reads as "nothing detected" and is not what happens.** The prose describes
`direct-subpackages` as the final fallback when nothing is configured, and that is the
observable behaviour. Do not conclude from the appendix that you must set the property; do
print the model if you need certainty.

**★ `sharedModules` changes test bootstrapping, not verification.** It declares modules that
are always included in application module integration tests, which removes a class of
repetitive `@MockitoBean` declarations for cross-cutting infrastructure. It does not grant
anyone permission to depend on those modules — that is still `allowedDependencies`.

**★ `explicitly-annotated` means a package without the annotation is not a module at all,
which reactivates the unassigned-code hole.** Types in unannotated packages belong to no
module, and code not assigned to a module is referenceable from everywhere. Switching
strategies without annotating everything you intended converts silent modules into a silent
free-for-all — see [31 · Explicit allowed dependencies](11e-explicit-allowed-dependencies.md).

**★ jMolecules' `@Module` is accepted by the annotated strategy as well as Spring Modulith's
own annotation.** Useful if you already use jMolecules, and a source of confusion if half the
codebase uses one and half the other. Pick one.

**★ `additionalPackages` requires knowing the packages in advance; `ApplicationModuleSourceFactory`
does not.** If the modules come from a library — an internal platform starter — the factory
registered in `META-INF/spring.factories` is the mechanism, because the application should
not have to name the library's packages.

## Interview questions

**★ Your existing codebase has feature packages one level too deep. What are the options?**
Three, in increasing cost. Set `spring.modulith.detection-strategy=explicitly-annotated` and
put `@ApplicationModule` on each real feature package — no classes move and the model matches
reality. Or implement `ApplicationModuleDetectionStrategy` and select module base packages by
whatever convention the codebase actually follows, registering it via the same property. Or
move the packages, which is the cleanest long-term answer and the most disruptive. The one
thing not to do is annotate the deep packages as nested modules of the intermediate package,
which produces a god-module no other module can address any part of.

**★ Where must a custom detection strategy live, and why?**
In production sources, with `spring-modulith-core` declared as a compile-time dependency, if
you use any runtime feature — the actuator, the observability support, or
`ApplicationModuleInitializer` beans. The reference warns about this in the fundamentals
chapter and repeats it at the top of both the runtime and production-ready chapters. A
strategy that exists only in test sources means verification enforces one module model while
the running application reports a different one, and nothing about that is obviously wrong
until you compare the actuator output against a verification failure and they disagree.

**★ What does `@Modulithic`'s `sharedModules` attribute do?**
It declares named modules as shared, which means they are always included in application
module integration tests. Practically, that removes the repetitive mocking of cross-cutting
infrastructure — a configuration module, a security module, a clock — from every
`@ApplicationModuleTest` in the codebase. It affects test bootstrapping only: it does not
grant any module permission to depend on the shared ones, which remains a matter for
`allowedDependencies`, and it does not change verification.

**★ What is the risk of switching to `explicitly-annotated`?**
That any package you forget to annotate stops being a module, and code not assigned to a
module is referenceable from every other module with no violation reported. Under
`direct-subpackages` an unnoticed package was at least *some* module; under
`explicitly-annotated` it becomes unassigned free-for-all territory, which is exactly the
hole that `common` and `util` packages exploit. Switch the strategy and audit the model
output in the same change, and consider a supplementary ArchUnit rule asserting that nothing
lives outside a module package.

{/* FOOTER */}
