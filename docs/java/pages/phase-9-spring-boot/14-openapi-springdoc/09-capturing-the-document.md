---
title: "Capturing the document as a versioned build artifact"
sidebar_label: "9 · Capturing the document"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-20 against the springdoc-openapi-maven-plugin README
> (github.com/springdoc/springdoc-openapi-maven-plugin — goal, phase and the
> `apiDocsUrl`, `outputDir`, `outputFileName`, `attachArtifact`, `headers`,
> `skip` and `failOnError` options; latest release **1.5**, published
> 2025-05-04 on Maven Central), springdoc.org/properties.html
> (`springdoc.writer-with-order-by-keys`, `springdoc.pre-loading-enabled`,
> `springdoc.cache.disabled`), and the springdoc release notes for #3281.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A document that only exists at `http://localhost:8080/v3/api-docs` is not a
contract — it is a debugging aid. It cannot be reviewed in a pull request,
cannot be diffed against the previous release, cannot be handed to a frontend
team before the service is deployed, and cannot be pinned by a consumer to a
version. Turning it into a file that CI produces, orders deterministically and
versions alongside the jar is one plugin and two properties, and it is what
converts springdoc from "nice UI" into something a consumer can build against.
Everything the next chunk does with the document depends on this one existing.**

## Capturing the document at build time

springdoc computes the document by inspecting a *running* application context,
so capturing it requires the application to start. That is exactly what the
`springdoc-openapi-maven-plugin` orchestrates, in concert with
`spring-boot-maven-plugin`:

```xml
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <executions>
    <execution><id>pre-integration-test</id><goals><goal>start</goal></goals></execution>
    <execution><id>post-integration-test</id><goals><goal>stop</goal></goals></execution>
  </executions>
</plugin>
<plugin>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-maven-plugin</artifactId>
  <version>1.5</version>
  <executions>
    <execution>
      <id>integration-test</id>
      <goals><goal>generate</goal></goals>
    </execution>
  </executions>
  <configuration>
    <apiDocsUrl>http://localhost:8080/v3/api-docs.yaml</apiDocsUrl>
    <outputFileName>openapi.yaml</outputFileName>
    <attachArtifact>true</attachArtifact>
    <failOnError>true</failOnError>
  </configuration>
</plugin>
```

`mvn verify` then starts the app, fetches the document, writes it, and stops the
app. The options and their documented defaults:

| Option | Default | Note |
|---|---|---|
| `apiDocsUrl` | `http://localhost:8080/v3/api-docs` | point at `.yaml` if you want YAML |
| `outputDir` | `${project.build.directory}` | must not start with `/` |
| `outputFileName` | `openapi.json` | |
| `attachArtifact` | `false` | attach to the build so it installs/deploys with the jar |
| `headers` | *(empty)* | needed if the doc endpoint requires authentication |
| `skip` | `false` | |
| `failOnError` | 🔴 **`false`** | see the gotcha below |

🔴 **`attachArtifact` is the option that makes this worth doing.** With it on,
the document is deployed to your artifact repository beside the jar, versioned
with the release. A consumer can then depend on *version 2.4.0's contract*
rather than on whatever the running service happens to return today — which is
the property a contract is supposed to have.

## Make the output deterministic first

A document you intend to diff must be byte-stable between builds, or every
release produces a diff full of reordering noise and nobody reads it.

```yaml
springdoc:
  writer-with-order-by-keys: true   # documented as: enable a deterministic/alphabetical ordering
```

Without it, ordering is whatever the reflection and scanning happened to
produce. springdoc's own changelog shows how real this is: 3.1.0 fixes #3281,
"Stabilize Spring Data `Page` schema property order" — the ordering of a
generated schema was genuinely non-deterministic across runs.

With a deterministic document, CI can do the thing that actually protects
consumers: **diff this release's document against the last published one and
fail the build on a breaking change** — a removed operation, a removed response,
a property that became required, a widened enum. That is a contract test you get
for the price of a stored file, and it is contract-first's discipline bolted on
to generation's honesty (chunk 3).

## Lazy generation, and what it costs

By default springdoc computes the document **on demand** and caches it —
`springdoc.pre-loading-enabled` is `false`, `springdoc.cache.disabled` is
`false`. So the first request to `/v3/api-docs` pays for scanning the whole
application; every later one is served from cache.

That is a sensible default for a service, and an awkward one for a build:
the plugin's fetch is by definition the first request, on a just-started JVM
that has warmed nothing. A large application can make that fetch slow enough to
trip whatever timeout sits in front of it.

The switch:

```yaml
springdoc:
  pre-loading-enabled: true   # build the document during startup instead
```

**This is a trade, not an improvement.** It moves the work into startup, which
is precisely the budget a container's startup and readiness probes are measured
against — and it does that on *every* instance, in every environment, including
ones where nobody will ever fetch the document. The reasonable position is to
enable it in the build profile that captures the artifact, and leave it off in
production, where you have probably disabled the endpoint anyway (chunk 8).

⚠️ One documented case forces your hand: springdoc's properties reference notes
that when its MCP support is enabled, `springdoc.pre-loading-enabled` is
"automatically forced to `true` by an environment post-processor", so the
specification is available at startup for tool registration.

## Gotchas

**⚠️ `failOnError` defaults to `false`**
**Symptom:** a green build that produced no document, or last week's document
left over in the workspace.
**Cause:** the plugin's documented default is not to fail the build on error, so
an application that did not start, or a doc endpoint that returned `401`, is
silently tolerated.
**Fix:** set it, always.

```xml
<failOnError>true</failOnError>
```

**⚠️ The doc endpoint is secured, so the plugin gets a `401`**
**Symptom:** an empty or missing output file, and — with the default above —
no failure.
**Cause:** the security work from chunk 8 applies to the plugin's fetch too.
**Fix:** either run the capture under a profile where the endpoint is permitted,
or send credentials via the plugin's `headers` option.

**⚠️ Diffing a non-deterministic document**
**Symptom:** every release shows hundreds of changed lines and the diff stops
being reviewed.
**Cause:** `springdoc.writer-with-order-by-keys` left at `false`.
**Fix:** turn it on for the profile that produces the artifact, before you build
any tooling on top of the diff.

**⚠️ Turning on `pre-loading-enabled` globally to fix a slow first fetch**
**Symptom:** startup time rises across every environment and a readiness probe
starts flapping under load.
**Cause:** the fix was applied to production as well as to the build.
**Fix:** scope it to the build profile.

```yaml
# application-openapi-capture.yaml
springdoc:
  pre-loading-enabled: true
  writer-with-order-by-keys: true
```

**⚠️ Publishing the document without a version**
**Symptom:** a consumer cannot say which contract they built against.
**Cause:** `openapi.yaml` overwritten at a fixed path.
**Fix:** `attachArtifact` so it is versioned with the release, and set
`info.version` to something that describes the contract rather than the jar —
the argument in [topic 07's versioning-strategy chunk](../07-rest-controllers/13-versioning-strategy.md).

## Interview questions

**★ Why capture the OpenAPI document as a build artifact instead of just serving it?**
Because a served document is whatever the currently-deployed code says, which
makes it useless as a contract. A captured, versioned artifact can be reviewed
in a pull request, diffed against the previous release to catch breaking
changes, published to consumers who pin a version, and used to generate clients
in a pipeline that has no access to a running instance of your service.

**★ How does the springdoc Maven plugin get a document out of a Spring application?**
By starting it. springdoc computes the document from a live application context,
so the plugin runs in the `integration-test` phase alongside
`spring-boot-maven-plugin`'s `start` and `stop` goals, fetches `apiDocsUrl` —
`http://localhost:8080/v3/api-docs` by default — and writes it to
`outputFileName`. It is an HTTP fetch, which is also why a secured endpoint
needs the `headers` option.

**★ What is the first thing you would configure before diffing documents in CI?**
Deterministic output — `springdoc.writer-with-order-by-keys=true`. Without it,
key ordering varies between builds and every diff is dominated by noise, so
nobody reads it and the check stops working. springdoc's own changelog has fixes
for non-deterministic schema property ordering, so this is not theoretical.

**★ What does `pre-loading-enabled` do, and when would you turn it on?**
By default the document is computed on the first request and then cached, so the
first caller pays the scanning cost. `pre-loading-enabled` moves that work into
application startup instead. Turn it on in the profile that captures the
artifact, where the plugin's fetch is always the first request. Leave it off in
production, where it spends startup budget — the budget your readiness probe is
measured against — on work nobody will use.

---

← Prev: [Security and lockdown](08-security-and-lockdown.md) · Index: [OpenAPI with springdoc](README.md) · Next → [The typed client](10-the-typed-client.md)
