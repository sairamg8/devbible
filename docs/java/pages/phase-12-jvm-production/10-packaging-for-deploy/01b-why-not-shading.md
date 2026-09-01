---
title: "Shading merges every dependency into one flat archive, and three things break silently when it does — service files overwrite each other, signatures stop verifying, and duplicate resources pick a winner without telling you"
sidebar_label: "01b · Why not shading"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Spring Boot specification**, "Executable Jar Format → Nested
> JARs" ([docs.spring.io](https://docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html));
> the **Apache Maven Shade Plugin** documentation — "Resource Transformers"
> ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/examples/resource-transformers.html))
> and the `shade:shade` mojo parameter reference
> ([maven.apache.org](https://maven.apache.org/plugins/maven-shade-plugin/shade-mojo.html));
> the **JAR File Specification** for JDK 25, "Signed JAR File"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html));
> and the **`java.util.ServiceLoader` javadoc** for JDK 25
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ServiceLoader.html)).
> 🔴 **No sandbox** — no build was run. Every failure described below is derived from the quoted
> specifications, not from an observed run.

**[01](01-the-fat-jar.md) said a Boot jar keeps its dependencies whole and a shaded jar does not.
This page is why that choice is worth a bespoke class loader. Shading is not wrong — it is the
right tool for a library and for a CLI that must hide a dependency version. What makes it the wrong
default for an application is that its failure modes are silent: the build succeeds, the artefact
is produced, and something stops working at runtime in a place that has no obvious connection to
packaging.**

## What shading actually does

The Shade plugin's own framing is the cleanest statement of the problem, and it is worth reading as
an admission rather than a feature description:

> *"Aggregating classes/resources from several artifacts into one uber JAR is straight forward as
> long as there is no overlap. Otherwise, some kind of logic to merge resources from several JARs is
> required. This is where resource transformers kick in."*

🔴 **"As long as there is no overlap" is the whole thing.** A class path never has this problem,
because a class path is an *ordered list of separate archives* — two jars can both contain
`config/defaults.properties` and both remain readable, addressed separately. Shading destroys that
structure by construction. Once every entry has been copied into one flat archive, a path can hold
exactly one file, and something has to decide which.

**The default decision is "first one wins, silently."** That is not a bug in the plugin — there is
no correct general answer, which is precisely why the plugin ships a catalogue of transformers to
let *you* answer it per resource.

Spring Boot's specification states the position in two sentences:

> *"A shaded jar packages all classes, from all jars, into a single "uber jar". The problem with
> shaded jars is that it becomes hard to see which libraries are actually in your application. It
> can also be problematic if the same filename is used (but with different content) in multiple
> jars."*

> *"Spring Boot takes a different approach and lets you actually nest jars directly."*

## Failure 1 · `META-INF/services` — the one that breaks `ServiceLoader`

This is the most consequential collision because the JDK's own extension mechanism depends on the
behaviour that shading removes.

The `ServiceLoader` javadoc specifies the discovery path:

> *"A service provider that is packaged as a JAR file for the class path is identified by placing a
> provider-configuration file in the resource directory `META-INF/services`. The name of the
> provider-configuration file is the fully qualified binary name of the service."*

and, decisively, **how those files are found**:

> *"Service providers in unnamed modules are located if their class names are listed in
> provider-configuration files located by the class loader's `getResources` method."*

🔴 **`getResources`, not `getResource`.** Plural. The mechanism is explicitly designed around *many
files at the same resource path*, one per providing jar, gathered across the whole class path. The
javadoc even accounts for the overlap: *"If a service provider class is named in more than one
configuration file then the duplicate is ignored."*

**Flatten that into one archive and the path holds one file.** Every provider listed in the losing
files vanishes — not with an error, but by simply never being enumerated.

⚠️ **What that looks like from the outside is never "packaging is broken".** It looks like a JDBC
driver that "is on the class path" but `DriverManager` cannot find; a `java.nio.file.spi`
filesystem provider that no longer handles its scheme; a logging binding that reverts to a
no-op; a Jackson module that stops registering. The stack trace points at the consumer, and the
consumer is innocent.

**The fix exists and must be asked for by name** — `ServicesResourceTransformer`, documented as:

> *"Relocated class names in `META-INF/services` resources and merges them."*

🔴 **Note that it does two jobs, and the second one is the one nobody remembers.** It merges the
files, *and* it rewrites the class names inside them to follow any relocation you configured. A
merge without that rewrite produces a file listing classes that no longer exist under those names —
which fails later, and differently.

## Failure 2 · Signatures — the one that fails loudly, then gets silenced badly

A signed jar carries, per the JAR specification, a manifest plus a signature file and a signature
block file:

> *"Each signer is represented by a signature file with extension `.SF`. The major part of the file
> is similar to the manifest file."*

> *"The signature block file associated with the signature file with the same base file name. This
> file stores the digital signature of the corresponding signature file in a PKCS #7 structure."*

The signature file carries digests, including one over the manifest's own main section:

> *"x-Digest-Manifest-Main-Attributes (where x is the standard name of a
> `java.security.MessageDigest` algorithm): The value of this attribute is the digest value of the
> main attributes of the manifest."*

and verification is unforgiving:

> *"If an `x-Digest-Manifest-Main-Attributes` entry exists in the signature file, verify the value
> against a digest calculated over the main attributes in the manifest file. If this calculation
> fails, then JAR file verification fails."*

> *"If any of the digest values don't match, then JAR file verification fails."*

🔴 **Shading writes a new manifest and a new entry set, then copies the old `.SF` and `.DSA`/`.RSA`
files in alongside.** The digests in those files describe an archive that no longer exists. The
JVM's verifier compares them against what it actually finds and, per the spec, verification fails —
so the application dies at class-load time with a security exception rather than at build time.

**The universally-recommended remedy is to delete the evidence**, via the `filters` parameter:

> *"Archive Filters to be used. Allows you to specify an artifact in the form of a composite
> identifier as used by `artifactSet` and a set of include/exclude file patterns for filtering which
> contents of the archive are added to the shaded jar."*

— excluding `META-INF/*.SF`, `META-INF/*.DSA`, `META-INF/*.RSA`. It works, and it is worth being
honest about what it costs.

⚠️ **You have not fixed the signature. You have discarded it.** The signed dependency is now
indistinguishable from an unsigned one, and the supply-chain property its publisher paid for is
gone from your artefact. For most dependencies nobody notices. For a **JCE provider**, which the
platform requires to be signed before it will load as a provider, the removal converts a loud
failure into a different loud failure, and the internet is full of advice to keep filtering harder.

🔴 **The spec also notes what is *not* signed**, which is why the signature-related files are the
only ones that can be dropped without disturbing the rest:

> *"Note that if such files are located in `META-INF` subdirectories, they are not considered
> signature-related. Case-insensitive versions of these filenames are reserved and will also not be
> signed."*

**Boot's format has none of this to argue about.** A signed jar in `BOOT-INF/lib/` is byte-identical
to the one the publisher released, so it verifies exactly as it did before you depended on it.

**Services and signatures are the two failures with a specification behind them. The third — every
*other* resource two dependencies happen to share — has no specification, only a catalogue of
merge strategies written after the fact: [01c](01c-the-collision-catalogue.md).**

## Gotchas

**★ 🔴 Shading breaks `ServiceLoader` by construction, not by accident.**
`ServiceLoader` finds providers through `getResources` — *plural* — which is designed around one
provider-configuration file per jar at the same path. One flat archive holds one file per path, so
every losing file's providers silently disappear.

**★ The symptom of a `META-INF/services` collision never mentions packaging.**
It is a JDBC driver `DriverManager` cannot find, a logging binding that goes quiet, a Jackson module
that stops registering. The stack trace accuses the consumer.

**★ `ServicesResourceTransformer` does two jobs, and people configure it for one.**
It merges the service files *and* rewrites relocated class names inside them. Merging without the
rewrite yields a file naming classes that no longer exist under those names.

**★ Duplicate provider names are explicitly tolerated, so merging is always safe.**
The javadoc: *"If a service provider class is named in more than one configuration file then the
duplicate is ignored."* There is no argument for preferring one file over another — concatenation is
strictly correct, which is exactly what makes silently dropping files indefensible rather than
merely unfortunate.

**★ Copied signature files make verification fail, per the spec.**
The `.SF` file's `x-Digest-Manifest-Main-Attributes` is checked against the actual manifest, and
*"if this calculation fails, then JAR file verification fails."* Shading rewrites the manifest, so
the copied digests describe an archive that no longer exists.

**★ 🔴 Filtering out `META-INF/*.SF`/`*.DSA`/`*.RSA` does not fix the signature — it discards it.**
The build goes green and the dependency's supply-chain guarantee is gone from your artefact. This is
the standard advice and it is rarely presented as the trade-off it is.

**★ A JCE provider must be signed to load.**
For that one class of dependency, stripping signatures converts one loud failure into another, and
no amount of additional filtering helps.

**★ Signature-related files are the only ones safe to drop, and the spec enumerates them.**
`META-INF/MANIFEST.MF`, `META-INF/*.SF`, `*.DSA`, `*.RSA`, `*.EC` and `SIG-*` — and *"if such files
are located in `META-INF` subdirectories, they are not considered signature-related."* A filter
pattern that reaches into subdirectories is deleting ordinary resources, not signatures.

**★ Signing covers everything else in `META-INF`, which is why the archive cannot be edited.**
*"Every file entry, including non-signature related files in the `META-INF` directory, will be
signed."* There is no subset of a signed jar you can rewrite and still have verify.

**★ 🔴 Both failures on this page are build-time decisions that fail at runtime.**
That is the unifying property of shading's risk, and it is why "the build is green" carries no
information at all about whether a shaded artefact is correct.

## Interview questions

**★ Why did Spring Boot invent a nested jar format instead of using the Maven Shade plugin?**
Because shading flattens every dependency into one archive, and a flat archive can hold only one
file per path. That silently breaks `META-INF/services` discovery, invalidates jar signatures, and
makes every duplicated resource a merge decision that has to be configured per file. Boot's format
keeps each dependency as an intact jar, so no path ever collides and none of those decisions exist.
The cost is a custom class loader and a small startup penalty.

**★ Explain precisely why shading breaks `ServiceLoader`.**
`ServiceLoader` locates providers through the class loader's `getResources` method — plural — which
returns *every* resource at the `META-INF/services` path for that service across the class path, one
per providing jar. The mechanism is built on the assumption that many files share that path. Shading
copies all of them to the same path inside one archive, where only one can survive, so the providers
listed in the others are never enumerated. Nothing errors; they simply are not there.

**★ What is `ServicesResourceTransformer` and what would you get wrong about it?**
It is the Shade transformer that merges `META-INF/services` files. The commonly missed half is that
it also rewrites relocated class names inside those files — so if you relocate packages and merge
without it, the merged file lists class names that no longer exist under those names, and discovery
fails a second way.

**★ Why does a shaded jar containing a signed dependency fail to start, and what does the usual fix
actually do?**
The signature file carries digests over the manifest and entries — including
`x-Digest-Manifest-Main-Attributes` — and the spec says verification fails if any digest does not
match. Shading writes a new manifest and a new entry set while copying the old signature files in,
so the digests describe an archive that no longer exists and the verifier rejects it. The usual fix
filters out `META-INF/*.SF`, `*.DSA` and `*.RSA`. That does not repair the signature; it deletes it,
so the dependency is now unsigned in your artefact and the publisher's guarantee is gone.

**★ What single question tells you whether a duplicated resource is dangerous?**
Whether anything reads it with `getResources` rather than `getResource`. The plural form means the
platform expects many files at that path and intends to see all of them, so losing one changes
behaviour. The singular form means one file was always going to win on a class path too, and shading
only changes which one.

**★ A colleague says "we've shaded for years and never had a problem." How do you respond?**
That is entirely plausible and it is not evidence. Every failure here is conditional on the
dependency graph actually containing an overlap — two jars shipping the same resource path, or a
signed dependency. A graph without those overlaps shades perfectly. The risk is that the property
holding it up belongs to today's dependency list rather than to the build, so it can be revoked by a
version bump that nobody reviews as a packaging change.

**★ Could Spring Boot have used shading and just configured the transformers correctly?**
In principle for any one dependency graph, yes. But the configuration would have to be maintained by
every application, against a dependency set that changes with every upgrade, with no build-time
signal when a new collision appears. Boot chose a format where the question cannot arise. That is
the difference between a problem you solve and a problem you make structurally impossible.

{/* FOOTER */}
