---
title: "What a starter actually is"
sidebar_label: "1 · What a starter is"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Build Systems ·
> Starters* and *Using Spring Boot* (docs.spring.io/spring-boot/reference —
> the starter naming convention and the `spring-boot-starter-parent` /
> `spring-boot-dependencies` split), the **Spring Boot 4.0 Migration Guide**
> (github.com/spring-projects/spring-boot/wiki — starter renames, the
> modularization, `spring-boot-starter-classic`), and the Spring Boot 4.0.0
> release announcement (spring.io/blog, 20 Nov 2025). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**A starter contains no code. Every `spring-boot-starter-*` artifact is an
empty jar whose entire content is a `pom.xml` full of `<dependency>` elements —
a curated, version-aligned set of transitive dependencies someone else already
tested together. Understanding that single fact is what turns "I added the
starter and it worked" into "I know exactly which twelve jars landed on my
classpath and which auto-configuration each one switched on", because in Spring
Boot the *presence of a class on the classpath* is the trigger for almost
everything that happens next.**

## The empty jar

Unpack `spring-boot-starter-webmvc` and there is nothing to read. No classes,
no resources — a POM and a `.pom` checksum. Its job is entirely
[transitive](../../phase-8-build-dependencies/02-dependency-scopes/README.md):

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-webmvc</artifactId>
  <!-- no <version> — the parent POM or the imported BOM supplies it -->
</dependency>
```

One line pulls in Spring MVC, the embedded Tomcat, Jackson, the validation
plumbing that Boot wires by default and the core Boot machinery — each at a
version the Spring team built and tested as a set. You could declare all of
them yourself. The reason nobody does is not typing effort; it is that picking
compatible versions of Jackson, Tomcat and Spring Framework by hand is a job
with a wrong answer, and the wrong answer shows up as a `NoSuchMethodError` in
production rather than a build failure.

## Where the versions come from — two different mechanisms

This is where people get stuck, because there are two ways to get managed
versions and teams inherit one without knowing which.

**`spring-boot-starter-parent` as your `<parent>`.** You inherit dependency
management *and* a pile of plugin configuration — the compiler `release`, the
resource filtering that lets `@...@` placeholders work in
`application.properties`, and the `spring-boot-maven-plugin` execution that
repackages your jar.

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.1.0</version>
  <relativePath/>   <!-- deliberately empty: look it up in the repository -->
</parent>
```

**`spring-boot-dependencies` imported as a BOM.** You get *only* the versions,
and you keep your own `<parent>` — which matters in a company where every
project inherits a corporate parent POM:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>4.1.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

`import` scope is the BOM mechanism from
[transitive dependencies and mediation](../../phase-8-build-dependencies/03-transitive-and-mediation/README.md):
it splices that POM's `dependencyManagement` in here and contributes no jar.
The cost of choosing the BOM over the parent is that you now configure the
`spring-boot-maven-plugin` yourself, and people routinely forget, which is why
the jar they ship is not executable.

## The naming convention, and why it is load-bearing

Official starters are `spring-boot-starter-*` under the `org.springframework.boot`
group id. Third-party starters are documented to invert it —
`acme-spring-boot-starter`, not `spring-boot-starter-acme` — precisely so that
`spring-boot-starter-` as a *prefix* stays a reliable signal that the artifact
came from the Spring team. When you see `spring-boot-starter-redis` in a POM,
somebody violated the convention and you should look at who publishes it.

## 🔴 Spring Boot 4 renamed the starters, and the internet has not caught up

This is the single biggest reason a Spring tutorial you find today will not
compile against 4.x. Boot 4.0 shipped **a full modularization** — the codebase
was split from a few large jars into many small, focused ones — and the starter
POMs were renamed to line up with the modules they now represent:

| Spring Boot 3.x and earlier | Spring Boot 4.x |
|---|---|
| `spring-boot-starter-web` | **`spring-boot-starter-webmvc`** |
| `spring-boot-starter-web-services` | `spring-boot-starter-webservices` |
| `spring-boot-starter-aop` | `spring-boot-starter-aspectj` |

The `web` → `webmvc` rename is the one that matters daily, and it is a genuine
improvement: `spring-boot-starter-web` never meant "the web", it meant
"Spring MVC specifically, and not WebFlux", and a decade of newcomers assumed
otherwise.

The migration guide is explicit that **the old starters still exist but should
be considered deprecated and will be removed in a future release** — so a 3.x
POM keeps building on 4.x, which is exactly why teams upgrade and never notice
they are on a deprecated artifact.

Two more consequences of the split you will meet immediately:

- **HTTP clients got their own starters** — `spring-boot-starter-restclient`
  for the imperative `RestClient`, `spring-boot-starter-webclient` for the
  reactive one. Previously they rode along inside the web starter.
- **Features that only needed a third-party jar now need their own starter.**
  Jakarta Bean Validation is the case everyone hits: `spring-boot-starter-webmvc`
  no longer drags in a validation provider, so `@Valid` silently does nothing
  until you add `spring-boot-starter-validation` explicitly.

### The escape hatch for a gradual migration

Boot 4 ships **`spring-boot-starter-classic`** (and
`spring-boot-starter-test-classic` for tests), which restores a classpath where
all the old infrastructure is present. It exists so a large application can move
to 4.x in one step and then unpick the modularization gradually. Treat it as
scaffolding with a removal ticket attached, not as a destination — the whole
point of the split was to stop shipping jars you do not use.

## The trade-off

A starter is a decision someone else made about your classpath, and you inherit
all of it. `spring-boot-starter-webmvc` gives you Jackson whether you serve JSON
or not; `spring-boot-starter-data-jpa` gives you Hibernate, a connection pool
and a transaction manager whether you wanted an ORM or just a `DataSource`. In
exchange you get a version set that is known to work and a single line to
review instead of twelve.

That trade is almost always worth taking for an application. It is a much worse
trade for a **library**, where every `compile`-scoped transitive dependency is a
constraint you impose on strangers — which is why libraries should depend on the
specific Spring modules they use, never on a starter.

## Gotchas

**Symptom:** you follow a well-known tutorial, add `spring-boot-starter-web`, and the build resolves fine — but a colleague says you are "on the old starter"
**Cause:** Boot 4 renamed it to `spring-boot-starter-webmvc` and kept the old artifact as a deprecated alias so 3.x builds keep working
**Fix:** rename it in the POM. The old names are documented as slated for removal in a future release, so this is technical debt with a deadline:
```xml
<artifactId>spring-boot-starter-webmvc</artifactId>
```

**Symptom:** `@Valid` on a controller parameter is simply ignored — no error, no 400, the invalid body reaches your service method
**Cause:** Boot 4's modularization removed the Bean Validation provider from the web starter; with no implementation on the classpath there is nothing to run the constraints, and Spring does not treat that as an error
**Fix:** add the dedicated starter — this is not optional on 4.x:
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

**Symptom:** `java -jar target/app.jar` fails with "no main manifest attribute"
**Cause:** you imported `spring-boot-dependencies` as a BOM instead of using `spring-boot-starter-parent`, so you inherited the versions but not the plugin configuration that runs `spring-boot-maven-plugin:repackage`
**Fix:** declare the plugin yourself, since nothing else will:
```xml
<build><plugins><plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions><execution><goals><goal>repackage</goal></goals></execution></executions>
</plugin></plugins></build>
```

**Symptom:** you add a `<version>` to a starter dependency "to be safe" and get a `NoSuchMethodError` at runtime
**Cause:** the pinned version disagrees with the managed set, so one artifact is out of step with the rest of the Boot dependency graph
**Fix:** delete the `<version>`. Managed versions are the entire point; to move one deliberately, override the documented property instead, e.g. `<jackson.version>` in `<properties>`, so the whole family moves together

**Symptom:** a third-party integration is published as `spring-boot-starter-acme` and nobody can tell whether Spring maintains it
**Cause:** the publisher ignored the documented convention that third-party starters use `acme-spring-boot-starter`, reserving the `spring-boot-starter-` prefix for official artifacts
**Fix:** check the group id, not the artifact id — `org.springframework.boot` is the only one that means official — and prefer integrations that follow the convention

**Symptom:** after upgrading to Boot 4 an application starts but a dozen unrelated features are quietly missing
**Cause:** the modularization moved features into separate modules, and the umbrella starter you were relying on no longer transitively supplies them
**Fix:** add `spring-boot-starter-classic` to get a working classpath immediately, then remove it once you have added the specific starters you actually need

**Symptom:** after upgrading to Boot 4 the main code compiles but the test sources do not, complaining about `MockMvc` or `TestRestTemplate`
**Cause:** `@SpringBootTest` no longer automatically provides MockMvc, WebTestClient or TestRestTemplate support — under the modularization those moved behind dedicated test starters
**Fix:** add the test starter the assertions need; the migration guide names `spring-boot-starter-restclient-test`, and a compilation failure on the test client may additionally need `spring-boot-resttestclient`:
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-restclient-test</artifactId>
  <scope>test</scope>
</dependency>
```

**Symptom:** a custom `Jackson2ObjectMapperBuilderCustomizer` bean stops being applied after the Boot 4 upgrade, and JSON output silently changes shape
**Cause:** Boot 4 moved to Jackson 3, which renamed the customization types — `Jackson2ObjectMapperBuilderCustomizer` became `JsonMapperBuilderCustomizer`, and `@JsonComponent`/`@JsonMixin` became `@JacksonComponent`/`@JacksonMixin`. The old bean is simply never consulted
**Fix:** rename the type and the annotations, and check the property namespace too — `spring.jackson.read.*` moved under `spring.jackson.json.read.*`

## Interview questions

**★ What is inside a Spring Boot starter?**
Nothing executable — a starter is an empty jar whose only meaningful content is
its `pom.xml`. That POM declares a curated set of transitive dependencies that
the Spring team has tested together at aligned versions. All the behaviour
people attribute to "the starter" is actually auto-configuration reacting to
classes those transitive dependencies put on the classpath, which is a separate
mechanism that happens to be triggered by them.

**★ `spring-boot-starter-parent` or the `spring-boot-dependencies` BOM — how do you choose?**
Use the parent when you have no other parent, because it gives you the managed
versions plus the plugin configuration: the compiler settings, the resource
filtering that makes `@...@` placeholders work in `application.properties`, and
the `spring-boot-maven-plugin` `repackage` execution. Import the BOM with
`<scope>import</scope>` when you already inherit a corporate parent POM, since
Maven allows only one `<parent>`. The trap in the BOM route is that you get
versions only — nobody configures the repackage plugin for you, and the first
symptom is a jar that will not run with `java -jar`.

**★ Boot 4 renamed several starters. Which rename matters most, and why did they do it?**
`spring-boot-starter-web` became `spring-boot-starter-webmvc`. The old name
implied "web support" when it always meant "Spring MVC and specifically not
WebFlux", so the rename removes a decade-old ambiguity and aligns the starter
with the module it represents under Boot 4's modularization. The old artifacts
still resolve but are documented as deprecated and scheduled for removal, so a
build that keeps working is not evidence that you are on the current name.

**★ Why does `@Valid` stop working after a Boot 4 upgrade?**
Because the modularization stopped the web starter from transitively supplying
a Jakarta Bean Validation provider. Spring only applies constraint validation if
an implementation is on the classpath, and with none present it does nothing
rather than failing — so the annotation is inert and invalid payloads flow
straight through to your service layer. Adding `spring-boot-starter-validation`
restores it, and this is the general shape of Boot 4 breakage: features that
depended on a third-party jar arriving transitively now need their own starter.

**★ Should a library depend on a starter?**
No. A starter is a broad set of `compile`-scoped transitive dependencies, and
every one of them becomes a constraint imposed on every consumer of your
library — versions they did not choose and cannot easily override, plus
auto-configuration that may switch itself on in their application because your
jar put a class on their classpath. Libraries should depend on the narrow Spring
modules they genuinely use, and ship their own auto-configuration if they want
opt-in wiring.

**★ What is `spring-boot-starter-classic` for, and when should you still be using it?**
It is a migration aid introduced with Boot 4's modularization that restores a
classpath containing the infrastructure the old umbrella starters used to
provide, so a large application can upgrade to 4.x in one move without chasing
every newly-separated module at once. You should be using it during a migration
and not after: leaving it in permanently reinstates exactly the "ship jars you
never use" problem the modularization was designed to fix.

**★ How do you change the version of a single dependency that a starter manages?**
Not by adding a `<version>` to the dependency, which desynchronises one artifact
from a set that was tested together and typically surfaces as a
`NoSuchMethodError` at runtime rather than a build failure. The supported route
is to override the documented version property in your own `<properties>` block
— `<jackson.version>`, for instance — so every artifact in that family moves
together and dependency management stays internally consistent. If you find
yourself overriding several, that is usually a signal to move to a different
Boot version rather than to fight the one you are on.

**★ What does the Boot 4 modularization change about testing?**
`@SpringBootTest` stopped automatically providing MockMvc, WebTestClient and
TestRestTemplate support, so test sources that compiled on 3.x can fail to
compile on 4.x with nothing wrong in the test itself. The fix is additive —
dedicated test starters such as `spring-boot-starter-restclient-test`, with
`spring-boot-resttestclient` for the client type specifically. It is the same
pattern as the main-source breakage: each feature module now ships its own
starter instead of riding along inside an umbrella one, so anything that used to
arrive transitively has to be asked for.

---

← Index: [Boot auto-configuration](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What `@SpringBootApplication` triggers](02-what-springbootapplication-triggers.md)
