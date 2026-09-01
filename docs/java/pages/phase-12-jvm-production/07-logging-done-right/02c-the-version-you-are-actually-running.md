---
title: "Spring Boot 4.1.0 pins Logback 1.5.34, Boot 4.1.1 pins 1.5.38, and between those two numbers sit a remote-code-execution fix and the removal of a configuration feature — which makes the managed logback version a thing you check rather than a thing you inherit"
sidebar_label: "02c · The version you are running"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback news and release notes page**, which is the source of
> every release description and CVE reference quoted below
> ([logback.qos.ch](https://logback.qos.ch/news.html)), and the published Maven poms
> **`spring-boot-dependencies:4.1.0`** (`<logback.version>1.5.34</logback.version>`) and
> **`spring-boot-dependencies:4.1.1`** (`<logback.version>1.5.38</logback.version>`)
> ([repo1.maven.org](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)).
> 🔴 **No sandbox.** No exploit was run and none is described. Version facts come from the poms and
> the vendor's own release notes.
> JDK 25 · Spring Boot 4.1.0 / 4.1.1 · SLF4J 2.0.18 · Logback 1.5.34 / 1.5.38.

**Logging libraries are boring right up until they are the CVE, and Logback has had an unusually
busy year. The pinned version in your BOM decides whether one of your configuration features
still exists, and the gap between two adjacent Spring Boot patch releases spans a remote-code
execution fix. This chunk is the version arithmetic, done once, from the poms and the vendor's
release notes rather than from a scanner's summary.**

## What each Boot version actually pins

Read straight out of the published poms:

| | Boot 4.1.0 | Boot 4.1.1 |
|---|---|---|
| `logback.version` | **1.5.34** | **1.5.38** |
| `slf4j.version` | 2.0.18 | 2.0.18 |
| `log4j2.version` | 2.25.4 | 2.25.4 |

Four Logback patch releases separate those two Boot versions, and three of them are security
releases.

## The `<if>` element and CVE-2026-13006

Logback's configuration format has long supported conditional processing — an `<if>` element with
a `condition` attribute evaluated as a Java expression by the **Janino** library. Evaluating
arbitrary Java at configuration time is exactly as dangerous as it sounds, and the release notes
record the escalation:

- **1.5.19** — *"Disallow `new` operator in the condition attribute of `<if>` elements. This fixes
  an ACE vulnerability recorded as CVE-2025-11226."*
- **1.5.35** — the `condition` attribute *"now rejects unicode escape sequences (`\u` and `\U`).
  This closes a bypass of the existing prohibition on the `new` operator"* — registered as
  **CVE-2026-13006**.
- **1.5.36** — rejects *"certain references that are associated with ACE attacks"*, same CVE.
- **1.5.37** — *"This version is the definitive fix for CVE-2026-13006."*

🔴 **And then they removed the feature.** The 1.5.37 notes:

> *"Due to the numerous vulnerabilities associated with conditional configuration processing based
> on the evaluation of Java expressions using the Janino library, support for conditional
> expressions using Janino has been removed."*

The replacement is the `<condition>` element, introduced in 1.5.20, which takes an implementation
of `PropertyCondition` rather than an arbitrary expression — a fixed vocabulary instead of a
compiler.

**So the practical statement is two-sided.** Boot 4.1.0's 1.5.34 predates the definitive fix.
Boot 4.1.1's 1.5.38 contains it — *and* has removed Janino conditionals, so if your
`logback-spring.xml` uses `<if condition="...">`, the Boot 4.1.0 → 4.1.1 upgrade is a
configuration migration, not a version bump.

⚠️ **Be precise about the exposure rather than alarmed.** The attack surface is the *configuration
file*: an ACE in `<if condition>` matters when an attacker can influence the configuration or the
properties it interpolates. A service whose `logback-spring.xml` is baked into the image and
references no external input is in a very different position from one that loads configuration
from a mounted volume or a config server. The right response is still to move to a fixed version;
the wrong response is to treat every Logback CVE as equivalent to Log4Shell, which it is not — none
of these are triggered by *logging a message*.

## The other 2026 fixes worth knowing

From the same release notes, because each one changes a default you might be relying on:

- **1.5.33** — `HardenedModelInputStream` restricts deserialisation of `java.lang` and
  `java.util` classes to an explicit allowlist (**CVE-2026-9828**); `SSLSocketAppender` now
  *"enable[s] hostname verification by default"* and defaults to TLSv1.2. If you were relying on
  a socket appender connecting to a host whose certificate does not match, it now fails.
- **1.5.34** — `HardenedObjectInputStream` throws `InvalidClassException` for `Proxy` classes
  (**CVE-2026-10532**). Both this and 1.5.33 concern *deserialisation*, which is the
  `SocketAppender`/`SimpleSocketServer` path — another reason not to ship logs over Logback's own
  socket protocol.
- **1.6.3** — `MDCBasedDiscriminator`, used by `SiftingAppender`, *"now strips forward and backward
  slashes (`/`, `\`) from MDC values before they are used as discriminating keys. This prevents
  path segments from escaping into destinations controlled by an attacker"* (**CVE-2026-19880**).

🔴 **That last one is a design lesson, not just a patch.** A `SiftingAppender` keyed on an MDC
value builds a *file name* from data that, in a web application, frequently originates in a
request header. Sifting by tenant or session id is a documented Logback pattern and it turns MDC
into a filesystem path. If you use it, the MDC value must be validated where it enters the MDC —
see [06](06-mdc.md) — not only where Logback consumes it.

## 1.5.x is legacy and Boot is still on it

The Logback project's own status, verbatim from the news page:

> *"Latest STABLE version: the 1.6.x series … The 1.5.x series is now considered legacy. Please
> note that the 1.6.x series is a direct descendant of and a drop-in replacement for the 1.5.x
> series."*

And on the older lines:

> *"The 1.2.x series has reached END-OF-LIFE. The 1.3.x series has reached END-OF-LIFE. The 1.4.x
> series has reached END-OF-LIFE."* — meaning *"No further feature updates, No bug fixes, No
> security patches for newly discovered vulnerabilities."*

⚠️ **Boot 4.1 manages a 1.5.x version, which the vendor calls legacy but is still actively
patched.** That is not a contradiction — a BOM does not chase a vendor's newest major line
mid-generation — but it does mean the "just use the Boot BOM and stop thinking" position has a
limit. **I could not find a Spring Boot statement committing to a specific Logback line for
4.1.x**, so I am not going to invent one; check the pom of the Boot version you are on rather
than assuming.

Overriding is one property, and it is the supported mechanism:

```xml
<properties>
  <logback.version>1.5.38</logback.version>
</properties>
```

🔴 **Override deliberately and test the configuration.** A logback version bump can remove a
configuration feature — as 1.5.37 did — so the failure mode is a container that will not start
because Joran cannot parse `logback-spring.xml`, which is a much louder failure than a subtly
wrong log level.

## The `logback-access` question

`logback-access` — the module that logs HTTP access lines from Tomcat or Jetty — was **relocated
to its own repository** for the 1.5.x/1.6.x series and versions independently (2.0.x). It is
*not* on the Boot managed-dependency list, so if you add it you own its version, its transitive
`logback-core` requirement, and its patch cadence. Given that Spring's own request logging and
your ingress/service mesh both already produce access logs, adding a third source with an
independent security lifecycle is a decision that should be made on purpose.

## What to actually do

1. **Read the pom, not the blog.** `./mvnw dependency:tree -Dincludes='ch.qos.logback:*'` prints
   the resolved version. That is the only number that matters.
2. **Know whether you use `<if condition>`.** Grep your `logback*.xml`. If you do, an upgrade past
   1.5.37 is a migration to `<condition>`; the vendor also offers a migration service, referenced
   from the release notes.
3. **Know whether you use `SiftingAppender` with an MDC key from user input.** If so, validate at
   the MDC boundary regardless of your Logback version.
4. **Do not ship logs over `SocketAppender`.** Two of the 2026 CVEs are deserialisation hardening
   on that path. Write to stdout and let the platform collect ([10](10-appenders-and-async.md)).
5. **Treat the logging library as an application dependency with an owner**, not as infrastructure
   that upgrades itself.

## Gotchas

**★ The Boot BOM's logback version is not automatically the current one.**
Boot 4.1.0 pins 1.5.34; 1.5.37 was the definitive fix for CVE-2026-13006. Four patch releases,
three of them security releases, sit between 4.1.0 and 4.1.1. Read your own pom.

**★ Upgrading Logback past 1.5.37 can break a working configuration file.**
Janino-based `<if condition="…">` support was **removed**, not deprecated. The symptom is a
startup failure parsing `logback-spring.xml`, which looks like a Boot problem and is not.

**★ `<condition>` and `<if condition>` are different things.**
`<condition>` (since 1.5.20) takes a `PropertyCondition` implementation from a fixed set.
`<if condition="…">` evaluated arbitrary Java through Janino and is gone. Same intent, different
element, different capability.

**★ Logback CVEs are not Log4Shell and treating them as identical wastes an incident.**
None of the 2026 issues are triggered by logging a message. They live in configuration parsing
(`<if>`), in deserialisation on the socket-appender path, and in MDC-derived file names for
`SiftingAppender`. The exposure question is "who can influence the configuration, the socket
stream, or the MDC key", not "does the application log".

**★ `SiftingAppender` turns an MDC value into a file path.**
CVE-2026-19880 exists because that value can carry `/` and `..`. Sanitising in 1.6.3 is a
backstop; the value should be validated where it enters the MDC, which is your filter, not
Logback's.

**★ `SSLSocketAppender` now verifies hostnames by default.**
Changed in 1.5.33. If a socket appender silently stops connecting after an upgrade, this is why —
and the fix is a correct certificate, not disabling the check.

**★ `logback-access` is not managed by the Boot BOM.**
It lives in its own repository with its own version line (2.0.x) and its own security cadence.
Adding it means owning that cadence.

**★ 1.2.x, 1.3.x and 1.4.x get no security patches at all.**
The vendor's END-OF-LIFE statement is explicit: no feature updates, no bug fixes, no security
patches for newly discovered vulnerabilities. An application pinned to 1.2.x for compatibility is
accumulating unpatched exposure by definition.

## Interview questions

**★ How would you determine which Logback version your service is running, and why not just trust
the Spring Boot version?**
Resolve it from the build — `dependency:tree` filtered to `ch.qos.logback` — because the BOM's
pin changes between patch releases and a transitive dependency or an explicit property can
override it. Concretely, Boot 4.1.0 manages Logback 1.5.34 and Boot 4.1.1 manages 1.5.38, and the
definitive fix for CVE-2026-13006 landed in 1.5.37. Knowing "we are on Boot 4.1" is not enough to
answer whether you have it.

**★ A security scanner flags Logback for a remote-code-execution CVE. Walk through your triage.**
First, identify which CVE and which code path — for the 2026 Logback issues the paths are
configuration parsing via Janino `<if condition>`, deserialisation on the socket-appender path,
and `SiftingAppender` file names derived from MDC. None of them fire on an ordinary log
statement, so the exposure question is who can influence configuration, socket input or MDC keys.
Second, check whether your service actually uses that feature: grep for `<if`, for socket
appenders, for `SiftingAppender`. Third, upgrade to the fixed version anyway — but budget for the
fact that 1.5.37 *removed* Janino conditionals, so if you use them the upgrade includes a
configuration migration to `<condition>`.

**★ Why is "the Boot BOM handles it" an incomplete answer for logging libraries specifically?**
Because a BOM pins a version at release time and does not chase a vendor mid-generation. Logback's
own project page currently calls 1.5.x legacy and 1.6.x stable, while Boot 4.1 manages a 1.5.x
line. That is a defensible choice — 1.5.x is still patched — but it means the currency of your
logging library is a decision someone should be making explicitly, with a property override
available when the answer is "we need the newer one".

**★ What is the risk in bumping `logback.version` yourself?**
That a patch-level bump removes a feature your configuration depends on. Logback 1.5.37 removed
Janino conditionals, so an application using `<if condition="…">` fails at configuration parse
time — the container does not start. That is loud rather than subtle, which is fortunate, but it
means a logging library bump needs the application to actually boot in CI before it merges, not
just to compile.

**★ Why does `SiftingAppender` deserve a second look during a security review?**
Because it constructs a destination — commonly a file name — from an MDC value, and in a web
application MDC values very often originate in request headers. That is a path-traversal shape:
data from the network becoming part of a filesystem path. Logback 1.6.3 now strips slashes as a
backstop, but the durable fix is validating the value at the point it enters the MDC, in the
filter that reads the header.

{/* FOOTER */}
