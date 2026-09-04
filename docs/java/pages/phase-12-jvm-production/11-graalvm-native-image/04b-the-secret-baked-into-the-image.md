---
title: "A native executable is a file an attacker can read, and build-time initialisation plus resource embedding are two independent ways to get a production secret into it — with a documented option that dumps the embedded heap for anyone holding the binary"
sidebar_label: "04b · The secret in the image"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Native Image Basics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/basics/)), "Reachability Metadata"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/)) and the
> "Create a Heap Dump from a Native Executable" guide
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/guides/create-heap-dump/));
> the **Spring Boot reference**, "Advanced Native Images Topics"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/advanced-topics.html)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.1 / Spring Framework 7.0.9**.
> Documentation-validated; **no sandbox run** — no binary was inspected to write this page; every mechanism below is quoted from documentation.

**[04](04-build-time-vs-run-time-initialisation.md) established that build-time initialisation stores static state in the image heap and that the image heap is copied out of the binary at start-up. Turn that around and it says something uncomfortable: whatever your static initialisers touched during the build is *inside a file*. Combine it with resource embedding — where a glob pattern decides which files are copied into the executable — and you have two independent, silent paths for a production credential to end up in an artefact that gets pushed to a registry, cached on a build agent, and copied onto a laptop. This is a security failure mode, not a performance footnote, and it needs a control in your build rather than a note in your wiki.**

## Path one: the image heap

The mechanism, restated from the reference:

> *"Values written to static fields by this code are saved in the **image heap**."*

> *"When native image starts up, it copies the initial image heap from the binary."*

So a `static final String` assigned during a build-time initialiser is **stored in the executable**. Not encrypted, not obfuscated — a `String` in the initial heap.

```java
// If this class is initialised at build time, the credential is now inside the binary.
public final class VaultClient {
    private static final String TOKEN = System.getenv("VAULT_TOKEN");
    private static final HttpClient CLIENT = HttpClient.newHttpClient();

    static Secret fetch(String key) { /* uses TOKEN */ }
}
```

On a JVM this is merely bad practice — the value comes from the process's environment at run time, and is at least scoped to the running process. In a native image it is baked in at build, so:

- **The value is the CI worker's, not production's.** If `VAULT_TOKEN` is set in the pipeline, that is the token that ships.
- **It cannot be rotated.** Rotating the credential does not change the binary. You now have an artefact that must be rebuilt to revoke a secret, and no inventory of which artefacts contain which secret.
- **It travels with the artefact.** Into the registry, into image layer caches, into anyone's `docker pull`.

⚠️ **The environment variable does not even need to be intentional.** Any build-time initialiser that reads `System.getenv`, `System.getProperty` or a file is a candidate, and the builder initialises application classes at build time *by inference* when it judges them safe ([04](04-build-time-vs-run-time-initialisation.md)) — so nobody had to write `--initialize-at-build-time` for this to happen.

## 🔴 The documented option that reads it back out

The heap-dump guide documents a flag whose purpose is precisely to inspect what the build put in the binary:

> *"Use the `-XX:+DumpHeapAndExit` command-line option to dump the initial heap of a native executable. This can be useful to identify which objects the Native Image build process allocated to the executable's heap."*

It requires the binary to have been built with `--enable-monitoring=heapdump`, and the result is an ordinary HPROF file openable in VisualVM or MAT.

**Use it as an audit tool.** Build with heap-dump support in a *pre-release* build, run `-XX:+DumpHeapAndExit`, and open the dump looking for strings that should not be there. It is the only direct way to answer "what did the build actually embed".

**And understand it as an exposure.** If you ship a production binary with `--enable-monitoring=heapdump`, anyone who can execute it can dump its initial heap. That is a deliberate trade-off — it is also how you diagnose an OOM in production ([07b](07b-no-jit-no-jfr-no-jstack.md)) — but it should be a decision, not a default inherited from a tutorial's command line.

⚠️ **Even without that flag, a binary is a file.** I have not verified any specific extraction technique against a GraalVM binary and will not claim one; what the documentation does establish is that the initial heap, including its `String` contents, is stored in the executable. Treat "the binary is a secure container" as false and design accordingly.

## Path two: embedded resources

Resource metadata decides which classpath files are copied into the binary, and the matching is by glob:

```json
{
  "resources": [
    { "glob": "**" }
  ]
}
```

That entry — or anything nearly as broad — embeds every classpath resource, including `application-prod.properties`, a bundled keystore, a `.env` that a build step copied into `target/classes`, and any test fixture that leaked into the main resource tree. The reference's own framing of the consequence is mild but exact:

> *"A consequence of this approach is that some parts of the application that use resources for configuration (such as logging) are effectively configured at build time."*

**The audit tools are documented and cheap.** The reference names two:

> *"1. Use the option `--emit build-report` to generate a build report for your native executable. There you can find information about all included resources under the `Resources` tab.*
> *2. Use the option `-H:+GenerateEmbeddedResourcesFile` to generate a JSON file `embedded-resources.json`, listing all included resources."*

For each resource you get *"Module … Name (resource path) … Origin (location of the resource on the system) … Type … Size"*. ⚠️ `--emit build-report` is **not available in GraalVM Community Edition** ([01b](01b-the-distribution-and-the-licence.md)); `-H:+GenerateEmbeddedResourcesFile` is, so on CE that is the one to wire into CI.

```bash
# Fail the build if anything that looks like a credential was embedded.
native-image -H:+GenerateEmbeddedResourcesFile ...
grep -Ei '(secret|credential|keystore|\.p12|\.jks|\.pem|application-prod)' \
     target/embedded-resources.json && { echo "Embedded a sensitive resource"; exit 1; }
```

That is a real gate: it turns "we should be careful with globs" into a build failure.

## Path three: the seeded generator

A subtler variant, and the one most likely to survive a code review:

```java
public final class TokenFactory {
    private static final SecureRandom RNG = new SecureRandom();       // seeded at build time?
    private static final long SALT = System.nanoTime();               // constant across every run
}
```

If the holder class initialises at build time, every process started from that binary shares whatever state was captured. For a `SecureRandom` this is a **cryptographic** failure, not a nondeterminism annoyance: identical binaries produce identical sequences.

🔴 **Do not reason about whether `SecureRandom` "would" be captured.** Force the answer:

```bash
native-image --initialize-at-run-time=com.example.security.TokenFactory ...
```

and prove it with `-H:+PrintClassInitialization`, which the reference describes as the way *"To track which classes were initialized and why"*.

## The countermeasures, in order

1. **No secret in a static field, ever.** This is good practice on a JVM and a hard rule here. Read credentials where they are used, from an injected component, at run time.

```java
// Run-time only: the value is read when the bean is used, from the process's own environment.
@Component
public class VaultClient {
    private final String token;

    public VaultClient(@Value("${vault.token}") String token) {
        this.token = token;
    }
}
```
   In Spring this is safe by construction, because AOT processing builds bean *definitions*, and *"Bean instances are not created during the AOT processing phase."* Constructor arguments are resolved at run time.

2. **Force run-time initialisation for every class that touches a credential, a clock, a hostname or a randomness source** — `--initialize-at-run-time=...`, listed explicitly in the build configuration rather than left to inference.

3. **Never let the build environment hold production secrets.** The strongest control is upstream of native image entirely: if `VAULT_TOKEN` is not set on the build agent, no initialiser can capture it. Native image raises the cost of getting this wrong; it does not create the problem.

4. **Narrow resource globs and gate on the embedded-resources inventory.** `db/migration/**` and `i18n/*.properties`, not `**`.

5. **Audit a pre-release build with `-XX:+DumpHeapAndExit`**, and decide deliberately whether `--enable-monitoring=heapdump` ships in the production binary.

6. **Decide once whether `--enable-monitoring` features are in production builds at all**, and record the decision. A production binary with `heapdump`, `jcmd` and `jfr` enabled is more debuggable and more exposed; both halves are real.

⚠️ **The parallel with CRaC is exact and worth reading.** Topic 15 covers the same failure for checkpoint images at [`04c-secrets-and-the-snapshot.md`](../15-checkpoint-restore-crac/04c-secrets-and-the-snapshot.md). Both technologies convert "process state" into "file", and both inherit the whole class of "the file went somewhere the process never would have".

## Gotchas

**★ Symptom: a credential is valid in production but is the *build* pipeline's credential.** Cause: a static initialiser read `System.getenv` during the build, and the CI worker's environment supplied the value. Fix: `--initialize-at-run-time` for that class, remove the static field, and audit the build agent's environment. Rotate the captured credential — it is in an artefact you have already published.

**★ Symptom: rotating a secret does not take effect until a rebuild.** Cause: the secret is in the image heap, so it is part of the artefact rather than part of the environment. Fix: treat this as a P1 architecture defect, not a deployment inconvenience — a secret you cannot rotate without a build is a secret you cannot rotate under incident conditions.

**★ Symptom: `application-prod.properties` is inside the binary.** Cause: a broad resource glob, most often `**` or a `**/*.properties` copied from an example. Fix: narrow the glob, and add `-H:+GenerateEmbeddedResourcesFile` plus a `grep` gate to CI, as shown above. External configuration should stay external; the whole point of `SPRING_DATASOURCE_PASSWORD` as an environment variable is defeated by embedding the file that would otherwise not have been read.

**★ Symptom: every instance of the service generates the same "random" identifiers.** Cause: the generator's seed or state was captured in a build-time-initialised static field. Fix: `--initialize-at-run-time` on the holder, verified with `-H:+PrintClassInitialization`. Treat any occurrence involving `SecureRandom`, a nonce, a session id or a CSRF token as a security incident and rotate whatever was derived from it.

**★ Symptom: a production binary can be made to write its own heap dump by anyone who can run it.** Cause: it was built with `--enable-monitoring=heapdump`, and `-XX:+DumpHeapAndExit` dumps the initial heap while `-XX:+HeapDumpOnOutOfMemoryError` and `SIGUSR1` dump the live one. Fix: decide deliberately. If heap dumps in production are worth having — and for diagnosing an OOM they usually are — then also ensure the heap does not contain anything a dump must not reveal, which is the same discipline as everything above.

**★ Symptom: the security review asks "what is in this binary" and nobody can answer.** Cause: no inventory was ever produced. Fix: produce two, in CI, on every build. `-H:+GenerateEmbeddedResourcesFile` gives the resource inventory; a `-XX:+DumpHeapAndExit` run of a monitoring-enabled build of the same commit gives the heap inventory. Both are cheap and both are reviewable.

**★ Symptom: "it is a compiled binary, so the string is not readable" appears in a design document.** Cause: a mental model borrowed from C. Fix: the reference states that the image heap — including its objects — is stored in the binary and copied out at start-up. A compiled binary is not a confidentiality boundary. Nothing in GraalVM's documentation claims otherwise.

## Interview questions

**★ How does a secret end up inside a native executable, and what makes it worse than the same mistake on a JVM?**
Two routes. Build-time class initialisation runs a static initialiser on the build machine and stores the resulting static fields in the image heap, which is *"copied from the binary"* at start-up — so a `static final String TOKEN = System.getenv(...)` captures the build agent's value into the artefact. And resource embedding copies classpath files matched by a glob into the binary, so a broad pattern pulls in `application-prod.properties` or a keystore. It is worse than on a JVM because the value is now a property of the artefact rather than of the process: it is the wrong environment's value, it cannot be rotated without a rebuild, and it travels wherever the binary goes.

**★ How would you audit what a native binary actually contains?**
Two documented tools. For resources: `-H:+GenerateEmbeddedResourcesFile` writes `embedded-resources.json` listing every included resource with module, path, origin, type and size — available in both distributions — and `--emit build-report` gives the same under a `Resources` tab, though that one is Oracle GraalVM only. For the heap: build with `--enable-monitoring=heapdump` and run with `-XX:+DumpHeapAndExit`, which the guide describes as useful *"to identify which objects the Native Image build process allocated to the executable's heap"*, then open the HPROF in MAT or VisualVM. Both belong in CI, the first as a gate and the second as a pre-release check.

**★ Why is a build-time-initialised `SecureRandom` a cryptographic failure rather than a performance quirk?**
Because every process started from that binary begins from the same captured state, so the sequence of "random" values is identical across every instance and every restart. Anything derived from it — session identifiers, nonces, tokens, CSRF values — is predictable to anyone with a copy of the binary. The severity is why you should not rely on the builder's safety inference to decide: mark the holding class `--initialize-at-run-time` explicitly and verify with `-H:+PrintClassInitialization`.

**★ Should a production native image be built with `--enable-monitoring=heapdump`?**
It is a genuine trade and you should be able to argue both sides. With it, you can dump the heap on `OutOfMemoryError`, on `SIGUSR1` or via `jcmd`, which is most of your diagnostic capability for a memory problem in a runtime that has no JVMTI and no attach-based tooling. Without it, an attacker who can execute the binary cannot ask it for its own memory. The defensible position is to enable it *and* ensure the heap holds nothing that must not be dumped — because if a heap dump would leak a credential, that credential was already in the wrong place.

**★ What is the relationship between this failure mode and CRaC's?**
They are the same failure with different mechanics, which is why topic 15 has a page on it too. Both technologies convert live process state into a file: native image captures the *initial* heap at build time, CRaC captures the *whole* heap of a running process at checkpoint time. In both cases the file then moves through registries, caches and laptops, in ways the original process never would have. CRaC's version is broader — it captures everything the JVM had seen, not just static state — but the control is identical: keep secrets out of long-lived in-memory state, and audit what the artefact contains.

**★ Your build agent has production credentials in its environment because the deploy step needs them. What do you say?**
That the deploy step's credentials should not be visible to the build step, and that native image turns this from a hygiene issue into an exfiltration path — any static initialiser that runs at build time and reads `System.getenv` will capture them into a published artefact, with no code review signal and no build failure. Split the pipeline so the compilation stage has no production secrets in its environment, and add the embedded-resources gate so the other route is closed too.

{/* FOOTER */}
