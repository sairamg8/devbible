---
title: "mvn spring-boot:build-image produces a production-shaped OCI image without a Dockerfile, and the price is that a builder image you did not write makes every decision this topic has spent twenty chunks teaching you to make deliberately"
sidebar_label: "07 · Buildpacks"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot reference**, "Packaging → Container Images → Cloud
> Native Buildpacks"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/container-images/cloud-native-buildpacks.html));
> and the **Spring Boot Maven plugin** reference, "Packaging OCI Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/maven-plugin/build-image.html)). Documented at
> Spring Boot 4.1.x. 🔴 **No sandbox** — no image was built and no build output below is a
> transcript. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Everything from [02c](02c-a-real-layered-dockerfile.md) onward has been a series of decisions:
which base image, which layers, which user, which archive. Buildpacks are the alternative in which
somebody else has already made all of them, competently, and hands you the result for one command.
That is a genuinely good trade for many teams. It is a bad trade made silently for the rest, and
the difference is whether you can say what the builder decided.**

## What a buildpack is

Spring Boot's explanation starts from a platform most readers have used:

> *"If you've ever used an application platform such as Cloud Foundry or Heroku then you've probably
> used a buildpack. Buildpacks are the part of the platform that takes your application and converts
> it into something that the platform can actually run. For example, Cloud Foundry's Java buildpack
> will notice that you're pushing a `.jar` file and automatically add a relevant JRE."*

> *"With Cloud Native Buildpacks, you can create Docker compatible images that you can run anywhere.
> Spring Boot includes buildpack support directly for both Maven and Gradle. This means you can just
> type a single command and quickly get a sensible image into your locally running Docker daemon."*

🔴 **"Sensible" is doing a lot of work in that sentence, and it is accurate.** The image you get is
layered, runs as a non-root user and has a JRE matched to your project. Producing the equivalent by
hand is the last several chunks of this topic.

## The goals

> *"The plugin can create an OCI image from a jar or war file using Cloud Native Buildpacks (CNB).
> Images can be built on the command-line using the `build-image` goal."*

```bash
mvn spring-boot:build-image
```

> *"The easiest way to get started is to invoke `mvn spring-boot:build-image` on a project."*

For a build that produces an image on every `package`, there is a second goal, and using the wrong
one is a documented mistake:

```xml
<plugin>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-maven-plugin</artifactId>
	<executions>
		<execution>
			<goals>
				<goal>build-image-no-fork</goal>
			</goals>
		</execution>
	</executions>
</plugin>
```

> *"Use `build-image-no-fork` when binding the goal to the package lifecycle. This goal is similar to
> `build-image` but does not fork the lifecycle to make sure `package` has run."*

⚠️ **Binding `build-image` to the lifecycle re-runs `package` from inside `package`.** The
`no-fork` variant exists precisely for that, and the symptom of getting it wrong is a build that is
mysteriously twice as slow.

## What it does about repackaging and dependencies

> *"While the buildpack runs from an executable archive, it is not necessary to execute the
> `repackage` goal first as the executable archive is created automatically if necessary."*

> *"When the `build-image` repackages the application, it applies the same settings as the
> `repackage` goal would, that is dependencies can be excluded using one of the exclude options. The
> `spring-boot-devtools` and `spring-boot-docker-compose` modules are automatically excluded by
> default (you can control this using the `excludeDevtools` and `excludeDockerCompose` properties).
> Pay also attention that optional dependencies are not included by default. If you have defined
> those modules as optional, you also need to set the `includeOptional` property to `true`."*

🔴 **Two silent-difference traps in one paragraph.** `devtools` and `docker-compose` are excluded —
which you want, and which means the image's classpath is *not* the classpath your tests ran against.
And **optional dependencies are omitted by default**, so a library marked `<optional>true</optional>`
that your application genuinely needs at runtime is simply absent from the image. That is a
`ClassNotFoundException` that reproduces nowhere except in the built image.

## It needs a Docker daemon

> *"The `build-image` goal requires access to a Docker daemon. The goal will inspect local Docker CLI
> configuration files to determine the current context and use the context connection information to
> communicate with a Docker daemon. If the current context can not be determined or the context does
> not have connection information, then the goal will use a default local connection."*

Configurable through `DOCKER_CONFIG`, `DOCKER_CONTEXT` and `DOCKER_HOST`.

⚠️ **This is the constraint that decides whether buildpacks fit your CI.** A pipeline that builds
images without a daemon — Kaniko, BuildKit in rootless mode, a hosted runner with no privileged
container — cannot run this goal as documented. It is not a small detail; it is often the reason a
team that likes buildpacks cannot adopt them.

## Layering is preserved, and so is your customisation

> *"The Paketo Spring Boot buildpack supports the `layers.idx` file, so any layer customization that
> is applied to it will be reflected in the image created by the buildpacks."*

🔴 **So [02](02-layered-jars.md) is not wasted work.** If you customised your layers in the Boot
plugin configuration, the buildpack honours it. The layering argument and the buildpack argument are
orthogonal: buildpacks decide the *base* and the *runtime*, `layers.idx` decides how your
application is cut up.

## The reproducibility trade

> *"In order to achieve reproducible builds and container image caching, buildpacks can manipulate
> the application resources metadata (such as the file "last modified" information). You should
> ensure that your application does not rely on that metadata at runtime. Spring Boot can use that
> information when serving static resources, but this can be disabled with
> `spring.web.resources.cache.use-last-modified`."*

⚠️ **A concrete, non-obvious consequence: HTTP `Last-Modified` headers and conditional GETs on
static resources.** Boot serves static resources using the file's last-modified time; buildpacks
normalise it for reproducibility. If your caching behaviour for static assets changes after moving
to buildpacks, this is why, and the documentation names the property that turns it off.

The plugin exposes the other half of reproducibility as a parameter:

> *"`createdDate` … A date that will be used to set the `Created` field in the generated image's
> metadata. The value must be a string in the ISO 8601 instant format, or `now` to use the current
> date and time."* — with the default described as *"A fixed date that enables build
> reproducibility."*

🔴 **The default `Created` date is fixed, not the build time.** This surprises people who read image
metadata to work out what is deployed. It is deliberate: a varying timestamp would make otherwise
identical builds produce different digests.

## The parameters worth knowing exist

| Parameter | What it controls | Default |
|---|---|---|
| `builder` | *"Name of the builder image to use."* | `paketobuildpacks/builder-noble-java-tiny:latest` |
| `runImage` | *"Name of the run image to use."* | *"the run image specified in Builder metadata should be used"* |
| `name` | *"Image name for the generated image."* | `docker.io/library/${project.artifactId}:${project.version}` |
| `publish` | *"Whether to publish the generated image to a Docker registry."* | Off |
| `pullPolicy` | When to pull builder and run images. *"Acceptable values are `ALWAYS`, `NEVER`"* and cache-if-present | — |
| `env` | *"Environment variables that should be passed to the builder."* | — |
| `buildpacks` | *"Only the specified buildpacks will be used, overriding the default buildpacks included in the builder."* | *"the builder should use the buildpacks included in it"* |
| `cleanCache` | *"Whether to clean the cache before building."* | Off |
| `createdDate` | The image's `Created` metadata | A fixed date |
| `applicationDirectory` | *"The path to a directory that application contents will be uploaded to"* | `/workspace` |
| `trustBuilder` | Whether the builder is *"trusted"* | Derived from a documented list of known builders |

⚠️ **`builder: …:latest` is the default.** Your image's base and JRE therefore change when somebody
else publishes a new builder tag, unless you pin it. That is exactly the property you would never
accept from a `FROM` line, and it arrives by default here.

The default image name is also worth reading carefully: `docker.io/library/...` means an accidental
`publish` targets Docker Hub's official-images namespace, which you do not have rights to. Set
`name` explicitly to your registry.

Tag references are parsed with documented defaults:

> *"The accepted format is `[domainHost:port/][path/]name[:tag][@digest]`. If the domain is missing,
> it defaults to `docker.io`. If the path is missing, it defaults to `library`. If the tag is
> missing, it defaults to `latest`."*

## The Java version is taken from your build

> *"The plugin detects the target Java compatibility of the project using the compiler's plugin
> configuration or the `maven.compiler.target` property. When using the default Paketo builder and
> buildpacks, the plugin instructs the buildpacks to install the same Java version."*

🔴 **So your `maven.compiler.target` silently selects your production JRE.** That is usually right
and occasionally very wrong — a project targeting 21 for library-compatibility reasons will get a
Java 21 runtime, not the JDK 25 your version spine assumes, and none of the JDK 25 features in this
phase will be available. [07b](07b-what-paketo-decides.md) covers the override.

## Gotchas

**★ Bind `build-image-no-fork`, never `build-image`, to the lifecycle.** The forking variant re-runs
`package`. The documentation says so and the symptom is a build that takes twice as long for no
visible reason.

**★ Optional dependencies are excluded by default.** *"optional dependencies are not included by
default… you also need to set the `includeOptional` property to `true`."* A runtime dependency
marked optional is missing only in the built image, which is the worst place to find out.

**★ `devtools` and `docker-compose` are excluded, so the image classpath differs from your tests'.**
Desirable, and still a difference. Anything that behaved differently because devtools was present
behaves differently again in the image.

**★ The default builder tag is `:latest`.** Your base image and JRE can change because somebody else
published. Pin the builder the way you would pin a `FROM`.

**★ The default image name is `docker.io/library/...`.** Publishing without setting `name` aims at
Docker Hub's official-images namespace. Always set it explicitly.

**★ It requires a Docker daemon.** *"The `build-image` goal requires access to a Docker daemon."*
Daemonless CI — Kaniko, rootless BuildKit, restricted hosted runners — cannot run it as documented.
Check this before adopting, not after.

**★ The image's `Created` date is a fixed date by default.** Deliberately, for reproducibility. Any
tooling or runbook that reads `Created` to determine deployment age will be wrong.

**★ Buildpacks normalise file last-modified metadata.** Which changes `Last-Modified` and conditional
GET behaviour for static resources. The documented escape hatch is
`spring.web.resources.cache.use-last-modified`.

**★ Your `maven.compiler.target` chooses your production JRE.** The plugin *"instructs the buildpacks
to install the same Java version."* If your compile target and your intended runtime differ, so will
the image.

**★ `layers.idx` customisation is honoured, so layering work carries over.** The Paketo Spring Boot
buildpack *"supports the `layers.idx` file"*. Buildpacks replace your Dockerfile, not your layering
strategy.

**★ `-Pnative` changes what this goal builds.** From [06b](06b-enabling-spring-aot-on-the-jvm.md):
the `native` profile configures *"Suitable settings so that `build-image` generates a native image."*
Enabling Spring AOT via the profile and building images with this goal are not independent choices.

## Interview questions

**★ What does `mvn spring-boot:build-image` actually give you?**
An OCI image built by Cloud Native Buildpacks, without a Dockerfile: layered according to
`layers.idx`, running as a non-root user, with a JRE matched to your project's compile target. Spring
Boot's phrasing is that you *"can just type a single command and quickly get a sensible image"*. The
cost is that a builder image you do not control has made every base-image, runtime and JVM-flag
decision.

**★ Why are there two goals, and which do you bind to the lifecycle?**
`build-image` forks the lifecycle to guarantee `package` has run, which makes it suitable for
command-line use. `build-image-no-fork` does not, and is the one to bind to an execution — otherwise
`package` runs twice.

**★ What is the most dangerous default in the plugin?**
Arguably `builder` defaulting to `paketobuildpacks/builder-noble-java-tiny:latest`. A floating tag
means your base image and JRE can change without any change to your repository — the same property
you would reject instantly in a `FROM` line. `docker.io/library/${artifactId}` as the default image
name is a close second.

**★ Your CI cannot run a Docker daemon. Can you still use buildpacks?**
Not with this goal as documented — it *"requires access to a Docker daemon"* and discovers it through
Docker CLI contexts. There are daemonless CNB paths in the wider ecosystem, but they are outside what
the Spring Boot plugin documents, and this constraint is a legitimate reason to write a Dockerfile
instead.

**★ Static resource caching changed after switching to buildpacks. Why?**
Because *"buildpacks can manipulate the application resources metadata (such as the file "last
modified" information)"* to achieve reproducible builds, and Boot uses last-modified when serving
static resources. The documented remedy is
`spring.web.resources.cache.use-last-modified`.

**★ A dependency is present in tests and missing in the built image. What is your first check?**
Whether it is `<optional>true</optional>`. The plugin documents that *"optional dependencies are not
included by default"* and requires `includeOptional`. The second check is `devtools` or
`docker-compose`, both excluded by default.

**★ Do buildpacks make the layering work from earlier in this topic redundant?**
No. The Paketo Spring Boot buildpack *"supports the `layers.idx` file, so any layer customization
that is applied to it will be reflected in the image"*. Buildpacks decide the base image and the
runtime; `layers.idx` decides how your application is split. They compose.

{/* FOOTER */}
