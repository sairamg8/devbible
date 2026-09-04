---
title: "Reachability metadata is a JSON contract between your dependencies and the builder — one file per artefact under META-INF, conditional on a type being reached, and increasingly enforced by a mode that turns a silent omission into an immediate error"
sidebar_label: "03b · Reachability metadata"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Reachability Metadata"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/)), "Build Options"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)) and "Build Configuration"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildConfiguration/));
> the **GraalVM Reachability Metadata Repository** ([github.com](https://github.com/oracle/graalvm-reachability-metadata)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run**.

**Metadata is the mechanism by which a closed world admits the dynamic bits you actually need. There are four ways to supply it, in a clear order of preference, and the whole ecosystem is mid-migration: the current format is a single `reachability-metadata.json` per artefact, the older five-file split is still accepted, and a new "exact" mode is on its way to becoming the default. Understanding the conditional-entry mechanism — `typeReached` — is what separates a metadata file that costs a few kilobytes from one that inflates every image that depends on your library.**

## The four ways to supply it, in the reference's own order

> *"- Compute metadata in code when the native binary is built and store the required elements in the initial heap of the native binary.*
> *- Place one or more `reachability-metadata.json` files in the `META-INF/native-image/<groupId>/<artifactId>/` directory on the classpath.*
> *- Use the `-H:Preserve=<classpath-selector>` flag.*
> *- Use the Feature API for advanced use cases where classpath scanning is necessary to compute correct metadata."*

**Prefer them in that order.** Constants in code cost nothing and cannot drift out of sync with the code they describe; JSON is the interoperable form and the only one a third-party library can ship; `-H:Preserve` is a sledgehammer with a documented size cost; the `Feature` API is for tool authors.

## Where the files live, and why the path has two segments

```
META-INF/
└── native-image/
    └── com.example/
        └── billing-client/
            ├── reachability-metadata.json
            └── native-image.properties
```

The Build Configuration page explains the reason the path carries group and artifact:

> *"To avoid a situation when constituent parts of a project are built with overlapping configurations, we recommended you use subdirectories within `META-INF/native-image`: a JAR file built from multiple maven projects cannot suffer from overlapping `native-image` configurations."*

The builder searches that directory and any subdirectory, and *"When multiple files with the same name are found, all of them are considered."* So metadata from ten dependencies merges by union — which is exactly why unconditional entries from a popular library are a tax on everybody.

⚠️ **Shading breaks this.** If you shade dependencies into one jar without merging their `META-INF/native-image` trees, you either lose metadata or collide it. Topic 10 owns shading ([`01b-why-not-shading.md`](../10-packaging-for-deploy/01b-why-not-shading.md)) and this is one more reason its argument holds.

Two other placements exist for metadata that is not on the classpath: `-H:ConfigurationFileDirectories=/path/to/config-dir/` for a plain directory, and `-H:ConfigurationResourceRoots=path/to/resources/` for classpath resources outside `META-INF/native-image`. Both accept comma-separated lists.

## The format

A single top-level object, one array per metadata kind:

```json
{
  "reflection": [],
  "resources": []
}
```

The reference points at the schema — `reachability-metadata-schema-v1.2.0.json` in the `oracle/graal` repository — and the reflection entry shape is:

```json
{
  "condition": { "typeReached": "com.example.BillingAutoConfiguration" },
  "type": "com.example.billing.Invoice",
  "fields": [ { "name": "amount" } ],
  "methods": [ { "name": "setAmount", "parameterTypes": ["java.math.BigDecimal"] } ],
  "allDeclaredConstructors": true,
  "allPublicConstructors": true,
  "allDeclaredMethods": true,
  "allPublicMethods": true,
  "allDeclaredFields": true,
  "allPublicFields": true,
  "unsafeAllocated": true,
  "serializable": true
}
```

**Three type spellings, not one.** A plain class is a string. A JDK proxy is an *ordered* interface list. A lambda class is a declaring class plus optional declaring method plus implemented interfaces:

```json
{
  "reflection": [
    { "type": { "proxy": ["com.example.Auditable", "java.io.Serializable"] } },
    { "type": { "lambda": {
        "declaringClass": "com.example.LambdaHost",
        "declaringMethod": { "name": "register", "parameterTypes": [] },
        "interfaces": ["com.example.SerializableFunction"] } },
      "serializable": true }
  ]
}
```

Resources use glob patterns rather than regexes, and the glob dialect is deliberately small: *"Supports only star (`*`) and globstar (`**`) wildcards"*, star matching *"any characters on one level"* and globstar *"at any level"*, with *"no empty patterns, trailing slashes, consecutive stars, or content mixed with globstars"*.

```json
{
  "resources": [
    { "glob": "db/migration/**" },
    { "module": "com.example.rules", "glob": "**/rules-*.drl" },
    { "bundle": "com.example.i18n.Messages" }
  ]
}
```

The `module` field is not decoration: *"This will cause the `native-image` tool to only include `resource-file.txt` from the Java module `library.module`"*, and it keeps enough module identity that module-aware lookups (`ClassLoader#getResource`, `ModuleReader#open`) resolve correctly at run time.

## 🔴 `typeReached` — the mechanism that keeps images small

The single most important idea in the format, and the one library authors get wrong:

> *"Each entry in JSON-based metadata should be *conditional* to avoid unnecessary growth of the native binary size."*

> *"A metadata entry with a `typeReached` condition is considered available at run time, only when the specified fully-qualified type is *reached* at run time. Before that, all dynamic accesses to the element represented with the `metadata-entry` will behave as if the `metadata-entry` does not exist. This means that those dynamic accesses will throw a missing-registration error."*

And "reached" has an exact definition — it is not "loaded", and it is not `Foo.class`:

> *"A type is reached at run time, right before the class-initialization routine starts for that type (class or interface), or any of the type's subtypes are reached."*

The reference's own worked example makes the trap explicit: referring to `ConditionType.class` **does not** reach the type, because *"`ConditionType.class` doesn't start class initialization"*. Calling a static method on it does.

**Why you should care as a consumer, not just an author.** An unconditional entry from a library you depend on is included in *your* image whether or not you use that part of the library. A conditional entry costs nothing until the guarding type is initialised. If your image is larger than you expect, the metadata that arrived with your dependencies is one of the first places to look.

## The exact mode — read this before it becomes the default

The reference carries a migration note, and it is the most consequential forward-looking item on this page:

> *"Native Image is migrating to the more user-friendly implementation of reachability metadata that shows problems early on and allows easy debugging."*

> *"To enable the new user-friendly reachability-metadata mode for your application, pass the option `--exact-reachability-metadata` at build time. To enable the user-friendly mode only for concrete packages, pass `--exact-reachability-metadata=<comma-separated-list-of-packages>`."*

> *"The user-friendly implementation for reflection will become the default in future releases of GraalVM so the timely adoption is important to avoid project breakage."*

Two run-time switches come with it, and they are the most useful diagnostic pair in this whole topic:

> *"To get an overview of all places in your code where missing registrations occur, without committing to the exact behavior, you can pass `-XX:MissingRegistrationReportingMode=Warn` when starting the application."*

> *"To detect places where the application accidentally ignores a missing registration error (with `catch (Throwable t)` blocks), pass `-XX:MissingRegistrationReportingMode=Exit` when starting the application. The application will then unconditionally print the error message with the stack trace and exit immediately. This behavior is ideal for running application tests to guarantee all metadata is included."*

🔴 **`Exit` in CI, `Warn` when you are investigating.** A `catch (Throwable)` somewhere in a framework can convert a missing registration into a fallback path that "works" until the day it does not, and `Exit` is the only thing that finds it. Put it on the native test run ([08](08-testing-a-native-image.md)).

## `-H:Preserve` — the escape hatch and its price

Added in GraalVM 25:

> *"GraalVM 25 introduces the `-H:Preserve` option. This lets you instruct the `native-image` tool to keep entire packages, modules, or all classes on the classpath in the native executable, even when static analysis cannot discover them."*

The selectors are `all`, `module=<module>`, `module=ALL-UNNAMED` (the classpath), `package=<package>` (with `*` for subpackages, and *"only the `*` wildcard is supported"*), and `path=<cp-entry>`, combinable with commas.

⚠️ **It is not a complete escape.** The reference is explicit: *"You must explicitly configure multi-interface proxy classes, arrays of dimension 3 and higher, and `.class` files as resources in the native image. Tooling-related Java modules are not included by default with `-H:Preserve=all`."*

And the cost: *"Using `-H:Preserve=all` requires significant memory and will result in much larger native images. Use the `-Os` flag to reduce image size."*

**Use it for discovery, not for deployment.** The documented workflow is to build once with `-H:Preserve` plus metadata tracing, run a representative workload, and take the resulting conditional metadata into normal builds — [03c](03c-the-tracing-agent.md).

## The legacy five-file format is still accepted

Older material — and Spring Boot 4.1's own reference — names five files rather than one. The GraalVM reference confirms both are read, in the sentence describing `-H:ConfigurationFileDirectories`:

> *"This directory must directly contain `reachability-metadata.json` or the formerly-used individual metadata files (`jni-config.json`, `reflect-config.json`, `proxy-config.json`, `serialization-config.json`, and `resource-config.json`)."*

⚠️ **This is a real, current documentation divergence and you will meet it.** Spring Boot 4.1's "Introducing GraalVM Native Images" page still lists what the AOT engine generates as *"Resource hints (`resource-config.json`) … Reflection hints (`reflect-config.json`) … Serialization hints (`serialization-config.json`) … Java Proxy Hints (`proxy-config.json`) … JNI Hints (`jni-config.json`)"*, while GraalVM's reference documents `reachability-metadata.json` as the format. **I found no document reconciling the two**; both are accepted by the builder, so treat the file names as an implementation detail and do not "fix" one to match the other. What matters is the directory.

## Who supplies it

- **The JDK and GraalVM** — for the standard library, built in.
- **Your framework.** Spring's AOT engine generates hints for your own beans, your configuration properties and its own machinery ([05](05-spring-boot-aot.md)). Boot states its scope plainly: *"Spring itself doesn't contain hints for 3rd party libraries and instead relies on the reachability metadata project."*
- **The library, in its own jar.** The best case: a dependency ships `META-INF/native-image/<groupId>/<artifactId>/reachability-metadata.json` and you never think about it.
- **The GraalVM Reachability Metadata Repository**, for libraries that do not. The Compatibility guide: *"The compatibility of Native Image with the most popular Java libraries was recently enhanced by publishing shared reachability metadata on GitHub. Users can share the burden of maintaining metadata for third-party dependencies and reuse it."* The Native Build Tools plugins consume it automatically and it is also published to Maven Central as `org.graalvm.buildtools:graalvm-reachability-metadata` with classifier `repository`, type `zip`.
- **You**, for your own reflective code and for gaps in all of the above — hand-written, or captured with the agent.

**Find the gaps before the build finds them.** Native Build Tools ships a goal for exactly this question:

```bash
./mvnw native:list-libraries-missing-metadata
```

which *"Scans direct external runtime dependencies"*, *"Uses the configured metadata repository as the source of truth"*, prints existing metadata issues or prefilled issue links, and writes `target/native/list-libraries-missing-metadata.json`. **Run it the day you propose native image, not the day you try to build it.** It answers "how much work is this" in seconds.

## Gotchas

**★ Symptom: metadata is present in the repository but the build still fails on that library.** Cause: the plugin matches metadata by library *version*, and there may be none for yours. Fix: the Maven plugin supports pinning the metadata version for a specific dependency — *"it is possible for you to override the metadata version of a particular module. This may be interesting if there is no specific metadata available for the particular version of the library that you use, but that you know that a version works."* Pin the nearest working version, and open an issue upstream.

**★ Symptom: a hand-written metadata file is ignored.** Cause: almost always the path. It must be under `META-INF/native-image/` (any subdirectory), and for your own hints Spring recommends a directory that does not collide with the generated ones — *"Place your static hint files in a directory that does not clash with this location, such as `META-INF/native-image/<groupId>/<artifactId>-additional-hints/`."* Fix: use that convention, and confirm with `native-image --verbose`, which *"shows from where `native-image` picks up the configurations"*.

**★ Symptom: your library's metadata makes every downstream image bigger.** Cause: unconditional entries. Fix: add `typeReached` conditions. *"Each entry in JSON-based metadata should be conditional to avoid unnecessary growth of the native binary size."* The condition should name the type whose initialisation implies the feature is in use — the auto-configuration class, the codec, the driver entry point.

**★ Symptom: a `typeReached` condition never fires, so the entry is never available.** Cause: the guarding type is referenced but never *initialised* — the reference's example shows that `ConditionType.class` does not reach the type. Fix: condition on a type that is genuinely initialised on the path that needs the metadata, typically the class holding the static entry point.

**★ Symptom: the build passes, the smoke test passes, and a rarely-used endpoint throws `MissingReflectionRegistrationError` in production.** Cause: metadata coverage equals the coverage of whatever produced it. Fix: `-XX:MissingRegistrationReportingMode=Exit` on the native test run, so an unregistered access fails the build instead of degrading silently, and make sure that test run exercises the endpoint.

**★ Symptom: `-H:Preserve=all` was added to unblock a release and image size doubled.** Cause: that is its documented behaviour — *"requires significant memory and will result in much larger native images."* Fix: replace it with metadata. Build once with `-H:Preserve` plus `-H:+MetadataTracingSupport`, run the workload with `-XX:TraceMetadata=path=<dir>`, merge the output, and ship the metadata rather than the preservation ([03c](03c-the-tracing-agent.md)).

**★ Symptom: shading produced a jar whose native build cannot find any library metadata.** Cause: the shade step dropped or collided `META-INF/native-image` trees. Fix: configure a resource transformer that preserves the group/artifact subdirectories, or stop shading — the group/artifact path exists *precisely* so that a merged jar can carry several configurations without conflict.

**★ Symptom: two proxies over the same interfaces, one works and one does not.** Cause: proxy metadata is an *ordered* interface list, so a different order is a different entry. Fix: register each order the application actually creates. Capturing with the agent is the reliable way to get this right; hand-writing it is how you miss one.

**★ Symptom: adopting `--exact-reachability-metadata` breaks a build that used to pass.** Cause: that is the point — exact mode surfaces omissions that the permissive mode tolerated. Fix: adopt it per package first (`--exact-reachability-metadata=com.example.billing`) and widen. The reference's warning is worth heeding: it *"will become the default in future releases of GraalVM so the timely adoption is important to avoid project breakage."*

## Interview questions

**★ What is reachability metadata, mechanically, and where does the builder look for it?**
It is JSON describing program elements that static analysis cannot prove reachable — reflected types, methods and fields, proxy interface lists, resource globs, resource bundles, serialized types, JNI-accessed members. The builder reads `reachability-metadata.json` from `META-INF/native-image/<groupId>/<artifactId>/` on any classpath entry, searching that directory and its subdirectories, and merging every file it finds. Additional directories can be supplied with `-H:ConfigurationFileDirectories` or `-H:ConfigurationResourceRoots`. The group/artifact segments exist so that a jar assembled from several projects cannot have overlapping configurations.

**★ What does `typeReached` do, and why is it the most important field in the format?**
It makes an entry conditional: the metadata is *"considered available at run time, only when the specified fully-qualified type is reached at run time"*, and before that any dynamic access behaves as if the entry did not exist. It matters because metadata merges by union across every dependency — an unconditional entry from a library is paid for by every application that depends on it, used or not. "Reached" is precisely defined as the moment just before class initialisation starts for that type or any subtype, which is why merely evaluating `Foo.class` does not reach `Foo`.

**★ You inherit a native build that only works with `-H:Preserve=all`. What do you do?**
Treat it as a diagnostic state, not a configuration. Its documented cost is significant build memory and much larger images, and it does not even cover everything — multi-interface proxies, arrays of dimension three or more, and `.class` files as resources still need explicit configuration. The path out is the documented one: rebuild with `-H:+MetadataTracingSupport` alongside the preservation, run representative workloads with `-XX:TraceMetadata`, merge the outputs with `native-image-utils generate`, commit the resulting conditional metadata, and drop the flag. In the meantime, `-Os` at least limits the size damage.

**★ How do you find out, before committing to native image, how much metadata work a project needs?**
Run `./mvnw native:list-libraries-missing-metadata`. It scans direct external runtime dependencies against the configured metadata repository, prints existing reachability-metadata issues where they exist and prefilled issue links where they do not, and writes a JSON report to `target/native/list-libraries-missing-metadata.json`. That output is the estimate. It will not catch reflection in your own code — the tracing agent and a native test run do that — but it settles the dependency question in one command.

**★ Why does Spring Boot's documentation name five JSON files while GraalVM's names one?**
Because the format is migrating and both are still read. GraalVM's reference documents `reachability-metadata.json` with a versioned schema, and separately states that a configuration directory *"must directly contain `reachability-metadata.json` or the formerly-used individual metadata files (`jni-config.json`, `reflect-config.json`, `proxy-config.json`, `serialization-config.json`, and `resource-config.json`)"*. Spring Boot 4.1's reference still describes the AOT engine as emitting the five-file form. No document reconciles the two, so the correct posture is: care about the directory, not the file names, and do not rewrite generated output to match either page.

**★ What is `-XX:MissingRegistrationReportingMode` for, and where in your pipeline does it belong?**
It controls what the binary does when a dynamic access has no metadata. `Warn` reports every occurrence without changing behaviour — the mode to use while investigating. `Exit` prints the error with a stack trace and exits immediately, which the documentation recommends *"for running application tests to guarantee all metadata is included."* It belongs on the native test run in CI, because it is the only thing that defeats a framework's `catch (Throwable)` silently converting a missing registration into a degraded fallback that ships.

{/* FOOTER */}
