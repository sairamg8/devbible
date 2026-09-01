---
title: "Distroless keeps glibc and Debian's provenance while deleting the shell and the package manager, which makes it the smallest change to your runtime that still meaningfully shrinks the attack surface — provided you notice that its Java image ships a JRE, fixes the ENTRYPOINT, and cannot be exec'd into"
sidebar_label: "03d · Distroless"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **GoogleContainerTools/distroless** repository — the project
> `README.md` and the build sources `java/README.md`, `java/java.bzl`, `java/config.bzl` and
> `common/variables.bzl` ([github.com](https://github.com/GoogleContainerTools/distroless)); the
> **JDK 25 `java` tool reference** for `JDK_JAVA_OPTIONS`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and
> the Kubernetes **"Debug Running Pods"** task page
> ([kubernetes.io](https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/)).
> 🔴 **No sandbox** — no image was pulled or built; the two size figures below are quoted from
> the distroless README, and the image contents are read from the project's own build files
> rather than from a running container. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[03b](03b-alpine-and-musl.md) and [03c](03c-musl-runtime-differences.md) showed that Alpine
buys image size with a change of C library. Distroless buys most of the security benefit without
that trade: it is Debian, with glibc, with Debian's packages and provenance — minus the shell,
the package manager, and everything else that is there for humans rather than for your process.
That is a much smaller behavioural change and a much larger operational one, and this chunk is
about the operational half, because three of its properties are invisible from the tag name.**

## What "distroless" means, precisely

The project defines itself in two sentences and both are load-bearing:

> *"'Distroless' images contain only your application and its runtime dependencies. They do not
> contain package managers, shells or any other programs you would expect to find in a standard
> Linux distribution."*

The argument for doing that is not primarily size:

> *"Restricting what's in your runtime container to precisely what's necessary for your app is a
> best practice employed by Google and other tech giants that have used containers in production
> for many years. It improves the signal to noise of scanners (e.g. CVE) and reduces the burden
> of establishing provenance to just what you need."*

🔴 **"Signal to noise of scanners" is the honest benefit and it is an organisational one.** Every
CVE announced against `bash`, `apt`, `coreutils` or `openssl-tools` in a base image generates
triage work for a team even when the vulnerable binary is never executed. Removing the binaries
removes the tickets, the exception requests and the argument about whether an unreachable
vulnerability counts.

Size is real but secondary, and the README quantifies only the smallest image:

> *"The smallest distroless image, `gcr.io/distroless/static-debian13`, is around 2 MiB. That's
> about 50% of the size of `alpine` (~5 MiB), and less than 2% of the size of `debian` (124 MiB)."*

⚠️ That is `static`, not the Java image. A Java distroless image carries a JRE and its native
dependencies, so it is not 2 MiB, and this page will not guess what it is.

## The three properties that are invisible from the tag

### 1 · The Java image ships a JRE — and `:debug` ships a JDK

The published Java tags for Debian 13 are `java-base-debian13`, `java17-debian13`,
`java21-debian13` and `java25-debian13`, each in four variants: `latest`, `nonroot`, `debug`,
`debug-nonroot`.

Reading `java/java.bzl` rather than the tag names settles what is actually inside:

- the **standard** image installs the Adoptium Debian package `temurin-<version>-jre`;
- the **debug** image installs `temurin-<version>-jdk`.

🔴 **So `:debug` is not "the same image with a shell added" — it is a different Java runtime.**
The README describes the shell half:

> *"Distroless images are minimal and lack shell access. The `:debug` image set for each language
> provides a busybox shell to enter."*

and, on tag composition:

> *"If the image you are using already has a tag, for example `gcr.io/distroless/java17-debian13:nonroot`,
> use the tag `debug-<existing tag>` instead, for example `gcr.io/distroless/java17-debian13:debug-nonroot`."*

The practical consequence connects straight back to [03](03-base-images.md): the standard tag has
no `jcmd`, `jstack` or `jmap` because a JRE package does not contain the `jdk.jcmd` tools, and the
debug tag has them because a JDK package does. If your incident plan is "switch the deployment to
`:debug` and attach", that plan works — and it changes the runtime, which is a thing to know
before you do it under pressure.

### 2 · The `ENTRYPOINT` is fixed, and it is `java -jar`

`java/README.md`:

> *"The entrypoint of this image is set to the equivalent of "java -jar", so this image expects
> users to supply a path to a JAR file in the CMD."*

and the build file confirms the exact vector: `entrypoint = ["/usr/bin/java", "-jar"]`.

🔴 **There is nowhere to put a JVM flag.** Everything this topic has built — the AOT cache from
[02d](02d-the-cache-variants-of-the-dockerfile.md), `-XX:MaxRAMPercentage` from topic 03,
`-Xlog:gc*` from topic 02 — normally goes between `java` and `-jar`, and that position does not
exist for you. There are exactly two correct answers:

**Override the entrypoint in your own Dockerfile.** This is the usual choice and it costs one
line, because the layered-extraction layout from [02c](02c-a-real-layered-dockerfile.md) already
launches an ordinary jar:

```dockerfile
FROM gcr.io/distroless/java25-debian13:nonroot
WORKDIR /application
COPY --from=builder --chown=nonroot:nonroot /builder/extracted/dependencies/ ./
COPY --from=builder --chown=nonroot:nonroot /builder/extracted/spring-boot-loader/ ./
COPY --from=builder --chown=nonroot:nonroot /builder/extracted/snapshot-dependencies/ ./
COPY --from=builder --chown=nonroot:nonroot /builder/extracted/application/ ./
ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-jar", "application.jar"]
```

**Or keep the entrypoint and use the launcher's environment variable.** The `java` tool reference
is explicit about what it does:

> *"`JDK_JAVA_OPTIONS` prepends its content to the options parsed from the command line. The
> content of the `JDK_JAVA_OPTIONS` environment variable is a list of arguments separated by
> white-space characters… These are prepended to the command line arguments passed to `java`
> launcher."*

So `ENV JDK_JAVA_OPTIONS="-XX:AOTCache=app.aot"` with `CMD ["/application/application.jar"]`
produces the same command line. This is also the mechanism that lets a platform team inject flags
into an image they do not own — which cuts both ways, and is a thing to check when a JVM is
behaving as though it was started with flags nobody can find.

### 3 · Shell-form instructions silently do not work

> *"Note that distroless images by default do not contain a shell. That means the Dockerfile
> `ENTRYPOINT` command, when defined, must be specified in `vector` form, to avoid the container
> runtime prefixing with a shell."*

> *"This works: `ENTRYPOINT ["myapp"]` … But this does not work: `ENTRYPOINT "myapp"`"*

This is the same rule that topic 12 cares about for a different reason — a shell-form entrypoint
puts a shell at PID 1, which by default does **not** forward `SIGTERM` to your JVM. On distroless
the shell-form entrypoint fails immediately and loudly, which is the friendlier outcome; on a
Debian base it works and then eats your shutdown signal. The vector form is correct on every base
image and mandatory on this one.

It also means no `$VARIABLE` expansion in the entrypoint, no `&&` chains, no wrapper script, and
no `exec java "$@"` idiom. If your image needs one of those, it needs a shell, and you should be
honest about that rather than reaching for `:debug` in production.

## The `java-base` image and where `jlink` fits

`java/config.bzl` lists exactly what `java-base-debian13` adds to the base image: `zlib1g`,
`libjpeg62-turbo`, `liblcms2-2`, `libfreetype6`, `fonts-dejavu-core`, `fontconfig-config`,
`libexpat1`, `libfontconfig1`, `libuuid1`, `libbrotli1`, `libcrypt1`, `libstdc++6`, `libgcc-s1`,
`gcc-14-base`, `libpng16-16t64`, `libbz2-1.0`.

🔴 **That is the native dependency set a JVM needs, with no JVM in it.** `java-base` exists to be
the runtime stage for a runtime *you* built — which is exactly the output of `jlink`
([04](04-jlink.md)). It is also the honest explanation for why the Java
distroless images are not 2 MiB: fontconfig, freetype and libstdc++ are not optional for a
general-purpose JVM.

## Supply chain: verify the image you are trusting

Minimising the image is a provenance argument, so the project closes the loop:

> *"All distroless images are signed by cosign with ephemeral keys (keyless). We recommend
> verifying any distroless image you use before building your image."*

```bash
cosign verify $IMAGE_NAME \
  --certificate-oidc-issuer https://accounts.google.com \
  --certificate-identity keyless@distroless.iam.gserviceaccount.com
```

If your reason for adopting distroless is CVE hygiene and you never verify the signature, you
have bought the smaller number without the property the smaller number was standing in for.

## Gotchas

**★ `:debug` changes your Java runtime, not just your shell.** Verified in `java/java.bzl`: the
standard tag installs `temurin-NN-jre`, the debug tag installs `temurin-NN-jdk`. Reaching for
`:debug` during an incident is a legitimate move and it is a runtime change — do not do it for
the first time at 03:00, and do not leave it in production afterwards.

**★ The Java image's `ENTRYPOINT` is `["/usr/bin/java", "-jar"]` and your flags have nowhere to
go.** Either override `ENTRYPOINT` in your own Dockerfile or set `JDK_JAVA_OPTIONS`. A `CMD` that
tries to pass `-XX:` flags lands *after* `-jar`, where the launcher treats them as arguments to
your `main` method rather than as VM options.

**★ `JDK_JAVA_OPTIONS` is a supply-chain surface as well as a convenience.** Anything that can set
an environment variable on your pod can prepend JVM options — including agents, dump paths and
`-D` properties. If a JVM is behaving as if it was started with flags nobody wrote, read the
environment before reading the Dockerfile.

**★ Shell-form `ENTRYPOINT`/`CMD` fails on distroless.** No `/bin/sh` exists to be prefixed. This
is a feature: the same construct on a Debian base silently inserts a shell as PID 1 that does not
forward `SIGTERM`, which topic 12 owns. Use the vector form everywhere.

**★ You cannot `kubectl exec` into it, by design.** The Kubernetes documentation names this case:
ephemeral containers exist for when *"a container image doesn't include debugging utilities, such
as with distroless images."* Rehearse `kubectl debug --target` before you need it, and remember
from [03](03-base-images.md) that `jcmd` additionally requires the same effective UID.

**★ You cannot install anything at runtime.** No package manager, no shell. Adding a CA
certificate, a diagnostic binary or a `curl` for a health check means rebuilding the image and
`COPY`ing the file in. Design the health check as an HTTP probe rather than an `exec` probe.

**★ The 2 MiB figure is for `static`, not for Java.** The README's comparison is
`gcr.io/distroless/static-debian13` against `alpine`. A Java image carries a JRE plus the sixteen
native packages `java-base` lists. Quoting 2 MiB in a design document about a Spring service is
quoting the wrong number.

**★ Distroless is Debian, so none of [03c](03c-musl-runtime-differences.md) applies.** glibc,
glibc's resolver, glibc's thread stack defaults. This is the main reason to prefer it over Alpine
when the driver is security rather than bytes: your application's runtime behaviour does not
change at all.

**★ `java-base` has no Java in it.** It is the native-library floor for a runtime you supply
yourself. Using it as though it were a JRE image produces an image with no `java` binary, which is
a confusing five minutes.

**★ Debian 13 distroless images use the UsrMerge scheme.** The README warns that if you add
packages with `rules_distroless` you must set `mergedusr = True`. Anyone constructing a custom
distroless-style image needs to know this before wondering why a binary is not on `PATH`.

**★ Unverified images defeat the point.** The project signs everything with keyless cosign and
recommends verifying before use. Adopting distroless for provenance and then pulling by mutable
tag without verification is theatre.

**★ Non-root is a separate decision from distroless.** The `latest` tags run as root; you have to
choose `:nonroot`. That is [03e](03e-non-root-and-filesystem.md), and it is where the UID 65532
in the distroless build files comes from.

## Interview questions

**★ What is a distroless image and what problem is it actually solving?**
An image that, in the project's words, contains *"only your application and its runtime
dependencies"* and *"do not contain package managers, shells or any other programs you would
expect to find in a standard Linux distribution."* The problem it solves is mostly organisational:
it *"improves the signal to noise of scanners (e.g. CVE) and reduces the burden of establishing
provenance"*. Size is a secondary benefit. Crucially it is still Debian and still glibc, so unlike
Alpine it does not change how your application behaves.

**★ Your Spring Boot image is distroless and you need to add `-XX:MaxRAMPercentage=75`. Where does
it go?**
Nowhere on the `CMD`, because the image's entrypoint is `["/usr/bin/java", "-jar"]` and anything
in `CMD` arrives after `-jar`, where it becomes an argument to `main`. Either override
`ENTRYPOINT` in your own Dockerfile — which you are probably doing anyway to launch the extracted
layered layout — or set `JDK_JAVA_OPTIONS`, which the `java` tool reference defines as
*"prepends its content to the options parsed from the command line."*

**★ How do you debug a wedged JVM in a distroless image?**
Not with `kubectl exec`; there is no shell. The documented route is an ephemeral container:
`kubectl debug --target`, which *"targets the process namespace of another container"*. That gets
you "same machine"; you must also run as the app's UID to satisfy `jcmd`'s second requirement. The
alternative, if you control the deployment, is to redeploy on the `:debug` tag — accepting that
this swaps the JRE for a JDK.

**★ Why is the distroless `:debug` tag not simply a better production image?**
Because it re-adds the two things distroless removed — a busybox shell and the full JDK — so it
reinstates the CVE surface and the interactive attack surface the standard tag deleted. It is a
diagnostic tool, and treating it as a production default is choosing a Debian-with-a-JDK image via
a confusing route.

**★ Distroless versus Alpine: how do you frame the choice?**
They optimise different variables. Alpine minimises bytes and pays with a different C library, so
DNS resolution, native thread stacks and locale defaults all change and your test history no
longer applies. Distroless minimises *programs* while keeping glibc and Debian packaging, so
nothing about your process's runtime behaviour changes and what you lose is interactive access.
If the constraint is registry and pull cost, Alpine plus `jlink`. If the constraint is CVE triage
and provenance — which it usually is — distroless.

**★ What is `gcr.io/distroless/java-base` for?**
It is the base image plus the native libraries a JVM needs — `zlib1g`, `libfreetype6`,
`libfontconfig1`, `libstdc++6` and a dozen more listed in the project's `java/config.bzl` — and no
Java at all. It is the runtime stage for a runtime you built yourself with `jlink`, which is the
combination that gives you a genuinely small Java image without leaving glibc.

**★ Why does the distroless documentation insist on the vector form of `ENTRYPOINT`?**
Because the shell form relies on the runtime prefixing the command with `/bin/sh -c`, and there is
no shell in the image. The project states it directly: the entrypoint *"must be specified in
`vector` form, to avoid the container runtime prefixing with a shell."* The same discipline is
worth applying on images that *do* have a shell, because a shell at PID 1 does not forward
`SIGTERM` to the JVM by default — which is topic 12's central failure.

**★ Someone adopts distroless "for security" and pulls `gcr.io/distroless/java25-debian13:latest`
by tag on every build. What have they missed?**
Two things. The image runs as **root** unless they choose the `:nonroot` tag, so the largest
single hardening win is still on the table. And they are not verifying the signature — the project
signs every image with keyless cosign and *"recommend[s] verifying any distroless image you use
before building your image."* Minimisation without verification improves the scan report without
improving the supply chain.

{/* FOOTER */}
