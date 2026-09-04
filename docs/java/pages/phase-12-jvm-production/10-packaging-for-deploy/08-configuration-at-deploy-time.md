---
title: "The image holds defaults and the environment holds everything else — a rule that survives contact with production only if you know that a secret written into a layer is permanent, that any SPRING_ environment variable is live, and that Spring AOT quietly revokes half of the arrangement"
sidebar_label: "08 · Configuration at deploy time"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference**, "Core Features → Externalized
> Configuration"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/external-config.html),
> documented at 4.1.x); the **Docker Dockerfile reference**, `ARG`
> ([docs.docker.com](https://docs.docker.com/reference/dockerfile/)); and the **Spring Framework
> reference**, "Core Technologies → Ahead of Time Optimizations"
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/core/aot.html)).
> 🔴 **No sandbox** — no image was built, no container was run and no property value below was
> observed. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**One image, promoted unchanged from staging to production, differing only in what the environment
supplies. That is the arrangement everything in this topic has been building toward, and it is worth
stating as a rule because three separate things in this topic break it: a secret baked into a layer
is not removable, an environment variable can bind to a property nobody documented, and Spring's AOT
processing freezes the part of configuration that decides which beans exist.**

## Where configuration can come from, and what that means for the image

Spring Boot's property source ordering is the ground truth. Later sources win:

> *"Sources are considered in the following order: Default properties … `@PropertySource`
> annotations on your `@Configuration` classes … Config data (such as `application.properties`
> files) … A `RandomValuePropertySource` … OS environment variables. Java System properties
> (`System.getProperties()`). JNDI attributes from `java:comp/env` … Properties from
> `SPRING_APPLICATION_JSON` … Command line arguments."*

and within config data specifically:

> *"Config data files are considered in the following order: Application properties packaged inside
> your jar (`application.properties` and YAML variants). Profile-specific application properties
> packaged inside your jar … Application properties outside of your packaged jar … Profile-specific
> application properties outside of your packaged jar"*

🔴 **Read the second list from a packaging point of view: what is inside your jar has the *lowest*
precedence of all config data.** That is not an accident, it is the design — Spring Boot's own
opening sentence is that externalized configuration lets you *"work with the same application code
in different environments"*. Properties inside the image are **defaults**, and treating them as
anything else fights the framework.

The practical rule that falls out:

| Belongs in the image | Belongs in the environment |
|---|---|
| Defaults that are correct everywhere | Anything that differs between environments |
| Structural configuration: bean wiring, serialisation settings, logging *pattern* | Endpoints, hostnames, credentials, pool sizes, log *level* |
| Everything you would be happy to publish | Anything you would not |

That last row is the operative one, because of the next section.

## A secret in a layer is permanent

Container image layers are content-addressed and immutable. Deleting a file in a later layer removes
it from the *filesystem the container sees* and leaves it in the *image*, where anyone who can pull
the image can recover it. There is no `RUN rm` that undoes a `COPY`.

Build arguments are worse, because they are recorded in metadata. The Docker reference is explicit:

> *"It isn't recommended to use build arguments for passing secrets such as user credentials, API
> tokens, etc. Build arguments are visible in the `docker history` command and in `max` mode
> provenance attestations, which are attached to the image by default if you use the Buildx GitHub
> Actions and your GitHub repository is public."*

⚠️ **"Attached to the image by default … if your GitHub repository is public."** That is a
supply-chain path from a build argument to the open internet, enabled by default, described in the
official documentation. If you need a credential *during* the build — a private Maven repository, for
instance — the documented mechanism is `RUN --mount=type=secret`, which the same reference points
you to, and which does not persist into a layer.

For runtime secrets, the answer is never in the image at all.

## Config trees: the mechanism for mounted secrets

Kubernetes projects Secrets and ConfigMaps as files. Spring Boot reads a directory of files as a
property source:

> *"you need to use the `configtree:` prefix so that Spring Boot knows it needs to expose all the
> files as properties."*

Given a mounted volume:

```
etc/
  config/
    myapp/
      username
      password
```

> *"The contents of the `username` file would be a config value, and the contents of `password` would
> be a secret."*

```properties
spring.config.import=optional:configtree:/etc/config/
```

> *"You can then access or inject `myapp.username` and `myapp.password` properties from the
> `Environment` in the usual way. The names of the folders and files under the config tree form the
> property name."*

Three details worth having:

- **The path determines the prefix.** Importing `/etc/config/` yields `myapp.username`; importing
  `/etc/config/myapp` yields `username`. The documentation states both.
- **`optional:` matters.** Without it, a missing directory is a start-up failure — which is exactly
  what you want in production and exactly what you do not want on a developer's machine.
- **Binary secrets work.** *"Configuration tree values can be bound to both string `String` and
  `byte[]` types depending on the contents expected."* — so a mounted keystore or certificate is
  bindable, not just text.

There is also a wildcard form: *"Any `configtree:` location that ends with `/*/` will import all
immediate children as config trees."*

🔴 **This is strictly better than environment variables for secrets**, because a mounted file is not
inherited by child processes, does not appear in `/proc/<pid>/environ`, and is not printed by a
crash handler that dumps the environment.

## Environment variables bind more loosely than you think

Relaxed binding means an environment variable maps to several property spellings:

> *"`${demo.item-price}` will pick up `demo.item-price` and `demo.itemPrice` forms from the
> `application.properties` file, as well as `DEMO_ITEMPRICE` from the system environment."*

with a rule for how to write the placeholder:

> *"You should always refer to property names in the placeholder using their canonical form
> (kebab-case using only lowercase letters)."*

🔴 **The security consequence is the one people miss: you cannot enumerate the environment variables
your image responds to.** Every Spring property in your application and in every starter on your
classpath has an environment-variable spelling. Anything that can set an environment variable on your
pod can change any property — including `spring.datasource.url` and, from
[07b](07b-what-paketo-decides.md), `JAVA_TOOL_OPTIONS`. Treat pod-spec write access as
application-configuration write access, because it is.

For property names that cannot be expressed as environment variables at all, Boot documents an
escape hatch:

> *"Environment variables and system properties often have restrictions that mean some property names
> cannot be used."*

— which is what `SPRING_APPLICATION_JSON` is for: one variable carrying structured JSON, sitting
above OS environment variables in the precedence order.

## Diagnosing where a value came from

> *"The `env` and `configprops` endpoints can be useful in determining why a property has a
> particular value. You can use these two endpoints to diagnose unexpected property values."*

⚠️ **Those endpoints expose your configuration, which is the point and also the risk.** Actuator's
exposure and security are Phase 9 topic 13's subject; the packaging-time decision is that an image
which ships Actuator ships them, and whether they are reachable is a deployment concern, not a
build-time one.

## Profiles: the part AOT takes away

Profiles are the natural way to express "this environment differs from that one", and
[06c](06c-what-aot-processing-gives-up.md) is the reason to be careful with them. Under Spring AOT
processing, `@Profile` *"needs to be chosen at build time and is automatically enabled at runtime
when AOT is enabled."*

🔴 **So the rule at the top of this page — one image, many environments — is incompatible with using
profiles to control *bean presence* in an AOT-processed build.** You get one artefact per profile, or
you restructure.

The restructuring is worth doing even without AOT:

- Beans exist unconditionally; **properties change what they do**.
- Environment differences become *values* — a URL, a pool size, a timeout, a feature flag read at
  runtime from `@ConfigurationProperties`.
- `@Profile` is reserved for genuinely different *code paths*, such as a test double that must never
  be in a production image at all.

That last exception is real and important: a `@Profile("test")` bean providing a stub payment gateway
should not merely be inactive in production, it should not be in the artefact.

## Gotchas

**★ Properties inside your jar have the lowest config-data precedence, deliberately.** They are
defaults. Anything environment-specific placed there will be overridden by every external source, so
if it is *not* being overridden, you have an environment that is silently running on defaults.

**★ Deleting a secret in a later layer does not remove it from the image.** Layers are immutable and
additive. Anyone who can pull the image can extract the earlier layer. There is no `RUN rm` that
undoes a `COPY`.

**★ Build arguments end up in `docker history` and in provenance attestations.** Verbatim from the
Docker reference, including the warning that attestations are attached by default under Buildx GitHub
Actions on a public repository. Use `RUN --mount=type=secret` for build-time credentials.

**★ Any Spring property has an environment-variable spelling.** Relaxed binding means
`DEMO_ITEMPRICE` reaches `demo.item-price`. You cannot produce a finite list of the variables your
image honours, so write access to the pod spec is write access to your configuration.

**★ Environment variables leak more readily than mounted files.** They are inherited by child
processes and visible in `/proc`. A mounted config tree is the better mechanism for secrets, and
Spring Boot supports it directly with `spring.config.import=optional:configtree:`.

**★ Forgetting `optional:` on a config tree import makes a missing directory a start-up failure.**
Which is correct in production and hostile locally. Decide per environment rather than removing the
import.

**★ A config tree's property prefix is the path you import.** `/etc/config/` gives `myapp.password`;
`/etc/config/myapp` gives `password`. Importing one level too high or too low produces properties
nobody is reading, and no error.

**★ Config trees bind `byte[]` as well as `String`.** So a mounted keystore or certificate is
directly bindable. Teams often base64 it into an environment variable instead, which is strictly
worse.

**★ Under Spring AOT, profiles stop being a deploy-time choice.** `@Profile` *"needs to be chosen at
build time and is automatically enabled at runtime when AOT is enabled."* One artefact per profile,
or restructure so that properties change behaviour rather than bean presence.

**★ A `@Profile("test")` bean is a build-time concern, not a runtime one.** A stub that must never
run in production should not be in the production artefact. That is a genuine, correct use of
profiles — and it is a packaging decision.

**★ `SPRING_APPLICATION_JSON` outranks OS environment variables.** It is above them in the documented
order, so a platform that sets it can override individually-set variables. Know which one your
platform uses before debugging a value that will not change.

**★ Actuator's `env` and `configprops` endpoints are the diagnostic and also an exposure.** They are
how you answer "why is this property that value"; they are also a full dump of your configuration.
Exposure is a deployment decision (Phase 9 topic 13), made about an image that already contains them.

## Interview questions

**★ What is the rule for deciding whether something belongs in the image or in the environment?**
The image carries defaults and structure; the environment carries anything that differs between
environments and anything you would not publish. Spring Boot's ordering encodes this — properties
packaged inside the jar have the lowest config-data precedence — and its stated purpose is to let you
*"work with the same application code in different environments"*.

**★ A credential was committed into an image layer and removed in the next `RUN`. Is the image
safe?**
No. Layers are immutable and additive; the file is still present in the earlier layer and recoverable
by anyone who can pull the image. The only remedies are to rebuild without it and to rotate the
credential. The same applies more sharply to build arguments, which the Docker reference says are
*"visible in the `docker history` command and in `max` mode provenance attestations"*.

**★ How would you get a Kubernetes Secret into a Spring Boot application without putting it in an
environment variable?**
A config tree. Mount the Secret as files and add
`spring.config.import=optional:configtree:/etc/config/`; Spring Boot exposes each file as a property
whose name is derived from the directory and file names, and binds `String` or `byte[]`. It is
better than an environment variable because a file is not inherited by child processes and does not
appear in `/proc`.

**★ Why can't you list the environment variables an image responds to?**
Because relaxed binding gives every property an environment-variable spelling —
`demo.item-price` is reachable as `DEMO_ITEMPRICE` — and the property set includes everything defined
by every starter on the classpath, not only your own. The security consequence is that write access
to a pod spec is equivalent to write access to the application's configuration.

**★ Your team wants one image promoted from staging to production, and also wants to use Spring AOT
processing. Can they have both?**
Only if environment differences are expressed as configuration *values* rather than as bean presence.
Under AOT, `@Profile` is chosen at build time and self-activates at run time, and
`@ConditionalOnProperty` is evaluated during the build. So beans must exist unconditionally and be
configured by properties. That restructuring is good practice regardless, and it is the price of
combining the two goals.

**★ When is `@Profile` still the right tool?**
When the difference is genuinely about which code exists, not about how it is configured — most
clearly a test double or a stub that must not be present in a production artefact at all. That is a
packaging decision: you are deciding what is *in* the image, which is exactly the kind of thing a
build-time mechanism should decide.

**★ How do you find out why a property has the value it has?**
Actuator's `env` and `configprops` endpoints — the reference names them for exactly this. Then work
the documented precedence order downward: command line, then `SPRING_APPLICATION_JSON`, then system
properties, then OS environment variables, then external config files, then the ones packaged in your
jar.

{/* FOOTER */}
