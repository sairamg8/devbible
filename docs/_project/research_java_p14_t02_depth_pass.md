---
name: research-java-p14-t02-depth-pass
description: 🔴 BANKED RESEARCH — do not re-fetch. Verbatim primary-source quotes for the Java phase-14 topic 02 depth pass over chunks 34-60: Spring Modulith 2.1.1 (fundamentals, verification, testing), ArchUnit, JPMS/State of the Module System, Gradle api-vs-implementation, Fowler StranglerFig + ParallelChange, ddd-crew context mapping definitions, microservices.io.
metadata:
  type: project
---

# Banked research — Java p14 t02, chunks 34–60

**Fetched 2026-09-04.** 🔴 **Do not re-fetch.** Every quote below is verbatim from the named
source. Written for the depth pass on `docs/java/pages/phase-14-microservice-architecture/02-service-boundaries/`
chunks 34–60. Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

⚠️ **Provenance note:** the Spring Modulith URLs are unversioned (`docs.spring.io/spring-modulith/reference/…`)
and therefore serve current docs. They are cited as "the Spring Modulith reference" without asserting
that the page is version-stamped 2.1.1.

---

## 1 · Spring Modulith — fundamentals (`/reference/fundamentals.html`)

**What an application module is** — three parts:
1. *"Provided Interface"* — API exposed to other modules via Spring bean instances and application
   events published by the module.
2. *"Internal Implementation"* — components not accessible to other modules.
3. *"Required Interface"* — references to APIs from other modules (bean dependencies, listened
   events, configuration properties).

**Default detection:** the application's **main package** (containing `@SpringBootApplication`) is the
root; *"Each direct sub-package of the main package is considered an application module package."*

**Simple modules (no sub-packages):** module API = all public types in the package; internal =
package-private types, hidden by Java's own package scope.

**Advanced modules (with sub-packages):** the module's base package is the **API package** and allows
incoming dependencies; *"Internal Packages: Any sub-packages of the module base package — code cannot
be referred to from other modules."* 🔴 **A `public` type in a sub-package is still internal.**

**`@NamedInterface`** — on `package-info.java`, exposes an additional package:
```java
// example/order/spi/package-info.java
@org.springframework.modulith.NamedInterface("spi")
package example.order.spi;
```
Referenced from another module with the `::` syntax:
```java
@org.springframework.modulith.ApplicationModule(allowedDependencies = "order :: spi")
package example.inventory;
```
*"This allows `inventory` to access `order.spi` but not `OrderManagement` from the base package."*
`"order :: *"` allows all declared named interfaces.

**Open vs closed modules.** Closed is the default. Open is `@ApplicationModule(type = Type.OPEN)`:
access to internals is *"generally allowed"*, all sub-package types join the unnamed named interface,
and it is *"Intended for legacy applications gradually adopting Spring Modulith"*. 🔴 The docs' own
warning: *"Using open modules in fully-modularized applications hints at sub-optimal modularization
and packaging structures."*

## 2 · Spring Modulith — verification (`/reference/verification.html`)

```java
ApplicationModules.of(Application.class).verify();
```

**The three rules, verbatim:**
1. *"No cycles on the application module level"* — *"the dependencies between modules have to form a
   directed acyclic graph."*
2. *"Efferent module access via API packages only"* — *"all references to types that reside in
   application module internal packages are rejected. Dependencies into internals of Open Application
   Modules are allowed."*
3. *"Explicitly allowed application module dependencies only"* (optional) — via
   `@ApplicationModule(allowedDependencies = …)`; *"If those are configured, dependencies to other
   application modules are rejected."*

**Custom violation handling:**
```java
ApplicationModules.of(…).detectViolations().filter(violation -> …).throwIfPresent();
```

## 3 · Spring Modulith — testing (`/reference/testing.html`)

`@ApplicationModuleTest` *"replaces `@SpringBootTest` but with bootstrap limited to specific
application modules."*

**Three bootstrap modes:** `STANDALONE` (default) *"Runs the current module only"* ·
`DIRECT_DEPENDENCIES` *"Runs the current module as well as all modules the current one directly
depends on"* · `ALL_DEPENDENCIES` *"Runs the current module and the entire tree of modules depended on."*

Dependencies are mocked with `@MockitoBean`. 🔴 The docs' own design signal: *"High coupling requiring
many mocked beans suggests reviewing dependencies for replacement with domain events."*

**Scenario API** — `Scenario` as a test method parameter:
```java
scenario.publish(new MyApplicationEvent(…))
  .andWaitForEventOfType(SomeOtherEvent.class)
  .matching(event -> …)
  .toArriveAndVerify(event -> …);
```
Also `scenario.stimulate(() -> someBean.someMethod(…))` and `.andWaitForStateChange(…).andVerify(…)`;
*"Non-`null` values and non-empty `Optional`s are considered conclusive state changes by default."*

## 4 · ArchUnit (`archunit.org/userguide`)

```java
ArchRule myRule = classes()
    .that().resideInAPackage("..service..")
    .should().onlyBeAccessed().byAnyPackage("..controller..", "..service..");
myRule.check(importedClasses);
```
`classes()` and `noClasses()` are both entry points on `ArchRuleDefinition`.

**Importer + options:**
```java
new ClassFileImporter()
    .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_JARS)
    .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
    .importClasspath();
```
Also `.importPackages(...)`, `.importPath(...)`.

**JUnit 5:** `@AnalyzeClasses(packages = "…")` on the class, `@ArchTest` on a
`public static final ArchRule` field.

**Slices / cycles:** `SlicesRuleDefinition.slices().matching("..myapp.(*)..").should().beFreeOfCycles()`

**Layered:**
```java
layeredArchitecture().consideringAllDependencies()
    .layer("Controller").definedBy("..controller..")
    .layer("Service").definedBy("..service..")
    .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller")
```
**Onion:** `onionArchitecture().domainModels(…).domainServices(…).applicationServices(…).adapter("persistence", …)`

**Freezing (the brownfield tool):** `FreezingArchRule.freeze(classes().should()…)`, configured in
`archunit.properties` with `freeze.store.default.path` and `freeze.store.default.allowStoreCreation`.

## 5 · JPMS — *The State of the Module System* (openjdk.org/projects/jigsaw/spec/sotms/)

- Declaration: *"The simplest possible module declaration merely specifies the name of its module:
  `module com.foo.bar { }`"*
- `requires`: *"One or more `requires` clauses can be added to declare that the module depends, by
  name, upon some other modules, at both compile time and run time."*
- `exports`: *"Finally, `exports` clauses can be added to declare that the module makes all, and only,
  the public types in specific packages available for use by other modules."*
- 🔴 **Strong encapsulation, the load-bearing sentence:** *"Thus, even when a type is declared
  `public`, if its package is not exported in the declaration of its module then it will only be
  accessible to code in that module."*
- ⚠️ The document itself notes it is *"slightly out of date"* — `requires public` was **renamed to
  `requires transitive`**. Cite the rename; do not quote `requires public` as current.

## 6 · Gradle `java-library` — `api` vs `implementation`

*"Dependencies appearing in the `api` configurations will be transitively exposed to consumers of the
library, and as such will appear on the compile classpath of consumers. Dependencies found in the
`implementation` configuration will, on the other hand, not be exposed to consumers, and therefore
not leak into the consumers' compile classpath."*

Four stated benefits, verbatim fragments: *"dependencies do not leak into the compile classpath of
consumers anymore, so you will never accidentally depend on a transitive dependency"* · *"faster
compilation thanks to reduced classpath size"* · *"less recompilations when implementation
dependencies change: consumers would not need to be recompiled"* · *"cleaner publishing"*.

Principle: only types in the library's public method signatures, superclasses, interfaces, fields and
annotations belong in `api`; everything else in `implementation`.

## 7 · Fowler — *StranglerFigApplication*

- Metaphor: *"These are vines that germinate in a nook of a tree. As it grows, it draws nutrients from
  the host tree until it reaches the ground to grow roots and the canopy to get sunlight."*
- Method: *"Like the fig, it begins with small additions, often new features, that are built on top
  of, yet separate to the legacy code base. As we do this we move bits of behavior from the legacy
  system into the new code base."*
- 🔴 On big-bang rewrites: *"We've seen this simple-sounding plan go down in flames most of the time.
  Replacing a serious IT system takes a long time, and the users can't wait for new features."*
- And: *"Replacements seem easy to specify, but often it's hard to figure out the details of existing
  behavior."*
- ⚠️ **The article does NOT discuss "event interception" or "asset capture".** Do not attribute those
  to this page.

## 8 · Fowler — *ParallelChange* (expand / migrate / contract)

- **Expand:** *"you augment the interface to support both the old and the new versions."*
- **Migrate:** *"you update all clients using the old version to the new version. This can be done
  incrementally."*
- **Contract:** *"you perform the contract phase to remove the old version and change the interface
  so that it only supports the new version."*
- Why: *"Making a change to an interface that impacts all its consumers requires two thinking modes:
  implementing the change itself, and then updating all its usages."* The payoff is that code can be
  *"released in any of these three phases"* and lets *"you migrate clients and to test the new version
  incrementally."*

## 9 · ddd-crew *Context Mapping Guide* — the DDD Reference (2015) definitions, verbatim

🔴 These are the canonical texts. The first authoring pass printed rewrites of four of them; see
[[progress-java-p14-t02-gemini-review]].

- **Partnership:** *"Where development failure in either of two contexts would result in delivery
  failure for both, forge a partnership between the teams in charge of the two contexts. Institute a
  process for coordinated planning of development and joint management of integration. The teams must
  cooperate on the evolution of their interfaces to accommodate the development needs of both systems.
  Interdependent features should be scheduled so that they are completed for the same release."*
- **Shared Kernel:** *"Designate with an explicit boundary some subset of the domain model that the
  teams agree to share. Keep this kernel small. Within this boundary, include, along with this subset
  of the model, the subset of code or of the database design associated with that part of the model.
  This explicitly shared stuff has special status, and shouldn't be changed without consultation with
  the other team."*
- **Customer/Supplier Development:** *"Establish a clear customer/supplier relationship between the
  two teams, meaning downstream priorities factor into upstream planning."*
- **Conformist:** *"Eliminate the complexity of translation between bounded contexts by slavishly
  adhering to the model of the upstream team. Although this cramps the style of the downstream
  designers and probably does not yield the ideal model for the application, choosing conformity
  enormously simplifies integration. Also, you will share a ubiquitous language with your upstream
  team. The upstream is in the driver's seat, so it is good to make communication easy for them.
  Altruism may be sufficient to get them to share information with you."*
- **Anticorruption Layer:** *"As a downstream client, create an isolating layer to provide your system
  with functionality of the upstream system in terms of your own domain model."*
- **Open Host Service:** *"A protocol that gives access to your subsystem as a set of services. Open
  the protocol so that all who need to integrate with you can use it."*
- **Published Language:** *"Use a well-documented shared language that can express the necessary
  domain information as a common medium of communication."*
- **Separate Ways:** *"Declare a bounded context to have no connection to the others at all, allowing
  developers to find simple, specialized solutions."*

🔴 **Partnership and Big Ball of Mud are DDD Reference (2015) patterns, NOT in the 2003 book.** The
2003 book's Chapter 14 *Maintaining Model Integrity* carries Bounded Context, Continuous Integration,
Context Map, Shared Kernel, Customer/Supplier, Conformist, Anticorruption Layer, Separate Ways,
Open Host Service and Published Language.

## 10 · microservices.io — *Microservice Architecture* pattern

Solution, verbatim: *"Design an architecture that structures the application as a set of two or more
independently deployable, loosely coupled, components, a.k.a. services."*
- *"Each service consists of one or more subdomains. Each subdomain is part of a single service except
  for shared library subdomains that are used by multiple services."*
- *"A service is owned by the team (or teams) that owns the (non-library) subdomains."*

🔴 **Note the carve-out** — "one subdomain, one service" has a stated exception for shared library
subdomains. Chunk 07 of this topic argues from the partition; the exception belongs in it.

## 11 · microservices.io — *Strangler Application*

- Problem: *"How do you migrate a legacy monolithic application to a microservice architecture?"*
- Solution: *"Modernize an application by incrementally developing a new (strangler) application
  around the legacy application."*
- ⚠️ **The page does NOT specify request routing, glue-code/ACL mechanics, or data replication during
  migration.** Anything a page says about those is either sourced elsewhere or must be written as the
  author's reasoning, not attributed here.

---

# APPENDED 2026-09-04 — sources for the head-band pass (chunks 12–23)

🔴 **Do not re-fetch.** Added for [[progress-java-p14-t02-headband-pass]].

## 12 · Conway, *How Do Committees Invent?* (1968) — melconway.com

- 🔴 The law itself: *"organizations which design systems (in the broad sense used here) are
  constrained to produce designs which are copies of the communication structures of these
  organizations."*
- The formal claim: *"there is a homomorphism from the linear graph of a system to the linear graph
  of its design organization."*
- On scale: *"two men and one hundred men cannot work in the same organizational structure…they will
  not design similar systems; therefore the value of their efforts may not even be comparable."*
- On organising for it: *"a design effort should be organized according to the need for
  communication"* and *"flexibility of organization is important to effective design."*

## 13 · microservices.io — the ten forces, verbatim

**Dark energy (pushes apart):**
1. **Simple components** — *"simple components consisting of few subdomains are easier to understand
   and maintain than complex components"*
2. **Team autonomy** — *"a team needs to be able to develop, test and deploy their software
   independently of other teams"*
3. **Fast deployment pipeline** — *"fast feedback and high deployment frequency are essential and are
   enabled by a fast deployment pipeline, which in turn requires components that are fast to build
   and test"*
4. **Support multiple technology stacks** — *"subdomains are sometimes implemented using a variety of
   technologies; and developers need to evolve the application's technology stack"*
5. **Segregate by characteristics** — separating components with differing resource, availability and
   security requirements.

**Dark matter (pulls together):**
1. **Simple interactions** — *"an operation that's local to a component or consists of a few simple
   interactions between components is easier to understand and troubleshoot than a distributed
   operation"*
2. **Efficient interactions** — *"a distributed operation that involves lots of network round trips
   and large data transfers can be too inefficient"*
3. **Prefer ACID over BASE** — *"it's easier to implement an operation as an ACID transaction rather
   than, for example, eventually consistent sagas"*
4. **Minimize runtime coupling** — keeping services tightly integrated maximises availability and
   reduces operation latency.
5. **Minimize design time coupling** — reducing the need for synchronised service changes improves
   development productivity.

## 14 · Nygard, *The Entity Service Antipattern* (2017)

- His definition of an antipattern: *"a commonly-rediscovered solution to a problem in a context, that
  inadvertently creates a resulting context we like less than the original context."*
- **Operational coupling** — a feature needing several entities calls several services; his cart
  example activates *"four of the five services in our architecture."*
- **Semantic coupling** — changes to entity services *"ripple through into"* dependents, which end up
  *"brokering between data formats."*
- ⚠️ **The post does NOT propose an alternative.** It closes with *"In a future post, we'll look at
  what to do instead of entity services."* Do not attribute a replacement pattern to this page.
- ⚠️ It does **not** discuss loose coupling / high cohesion in those terms.

## 15 · microservices.io — Assemblage, system operations

- *"A system operation is an invokable behavior implemented by the application."*
- They model *"the application's black box behavior"*; examples given are `createCustomer()`,
  `createOrder()`, `cancelOrder()`, `findOrderHistory()`.
- 🔴 *"a system operation reads and/or writes one or more business entities, a.k.a. DDD aggregates,
  such as `Customer` and `Order`."*
- Subdomains consist of aggregates *"acted upon by system operations"*; services are then formed by
  *"grouping the subdomains"*, with distributed operations designed using Saga, API Composition and
  CQRS.
