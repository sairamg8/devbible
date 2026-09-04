---
title: "musl documents its differences from glibc honestly, and four of them — thread stack size, parallel DNS resolution, the search-list rule and the default locale — reach a JVM through native code, Kubernetes service discovery and filename encoding respectively"
sidebar_label: "03c · What musl changes at runtime"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **musl libc wiki**, "Functional differences from glibc"
> ([wiki.musl-libc.org](https://wiki.musl-libc.org/functional-differences-from-glibc.html));
> **JEP 400 · UTF-8 by Default** ([openjdk.org](https://openjdk.org/jeps/400), Closed/Delivered,
> Release 18); and the **JDK 25 `java` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)) for
> `-Xss`. 🔴 **No sandbox** — no container was started, no resolver was queried and no crash
> below is a transcript. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[03b](03b-alpine-and-musl.md) established that choosing Alpine means choosing musl. This chunk
is the part that decides whether that was a good idea: the specific, documented ways musl behaves
differently from glibc, filtered down to the ones with a plausible path into a running Java
service. musl publishes this list itself, which is more than most platform changes give you —
the failure mode is not that the information is hidden, it is that nobody reads it before
changing the `FROM` line.**

## Thread stack size — the one that surprises native libraries

> *"The default stack size for new threads on glibc is determined based on the resource limit
> governing the main thread's stack (RLIMIT_STACK). It generally ends up being 2-10 MB. musl
> provides a default thread stack size of 128k (80k prior to 1.1.21)."*

That is a difference of one to two orders of magnitude, and it is the single most consequential
entry on the page.

🔴 **It is not directly a Java-thread problem.** The JVM sets Java thread stacks explicitly —
that is what `-Xss` is for, and the `java` tool reference documents it as *"Sets the thread stack
size (in bytes)"* with a platform-dependent default. Threads the JVM creates get the size the
JVM asked for, on any libc.

**The exposure is native code.** A JNI library, a native database driver, an embedded native
runtime or a bundled agent that spawns its own threads and does not set a stack size inherits
128 KB on musl where it inherited megabytes on Debian. musl's own advice is exactly this:

> *"Programs needing larger stacks, or which explicitly want a smaller stack, should make this
> explicit with `pthread_attr_setstacksize`."*

musl also notes the escape hatch for programs that cannot be changed:

> *"Since 1.1.21, musl supports increasing the default thread stack size via the PT_GNU_STACK
> program header, which can be set at link time via `-Wl,-z,stack-size=N`."*

— which is a link-time property of the binary, so it is available to whoever built the native
library and not to you at deploy time.

⚠️ **The symptom does not look like a stack problem.** A Java stack overflow throws
`StackOverflowError` with a readable trace. A native stack overflow produces a SIGSEGV and a
HotSpot fatal error log with the crash in native frames — which is why this gets misdiagnosed as
a broken library rather than a platform difference. If an image containing native dependencies
crashes only on Alpine, this is hypothesis one.

## DNS resolution — the one that bites in Kubernetes

musl's resolver is deliberately, documentedly different, and every difference interacts with how
Kubernetes generates `/etc/resolv.conf`.

**Parallel queries, first answer wins:**

> *"Traditional resolvers, including glibc's, make use of multiple nameserver lines in
> resolv.conf by trying each one in sequence and falling to the next after one times out. musl's
> resolver queries them all in parallel and accepts whichever response arrives first."*

with the consequence spelled out:

> *"Try to make sure that your nameservers agree on the answers they give, as it's not guaranteed
> that the first response will be from a local nameserver."*

In a split-horizon DNS setup — an internal resolver that knows your private names and an upstream
that returns a public answer for the same name — glibc's sequential behaviour hid the
disagreement by always asking the first nameserver first. musl surfaces it as an intermittent,
latency-dependent wrong answer, which is about the worst possible shape for a bug.

**The `search` and `ndots` rule:**

> *"queries with fewer dots than the ndots configuration variable are processed with search first
> then tried literally (just like glibc), but those with at least as many dots as ndots are only
> tried in the global namespace (never falling back to search, which glibc would do if the name
> is not found in the global DNS namespace)."*

musl explains *why*, and the reasoning is sound even though the effect is inconvenient:

> *"This difference comes from a consistency requirement not to return different results subject
> to transient failures or to global DNS namespace changes outside of one's control (addition of
> new TLDs)."*

🔴 **Kubernetes generates `ndots:5` and a multi-entry search list.** A partially qualified name
that glibc would have found by falling back to the search list can therefore fail on musl. The
fix is not to fight the resolver — it is to **fully qualify service names** (the
`name.namespace.svc.cluster.local` form, or a trailing dot), which is better practice on glibc
too because it eliminates several wasted lookups per resolution.

**DNS over TCP, and a version gate:**

> *"musl's resolver did not support the use of DNS over TCP until version 1.2.4. This difference
> prevented the use of larger packets produced by protocols such as DNSSEC and DKIM."*

If you are on an older Alpine base and seeing truncation-shaped DNS failures, check the musl
version before blaming anything Java.

**And a difference in the other direction, in musl's favour:**

> *"When getaddrinfo is called with AF_UNSPEC, glibc returns a result even if one of the address
> families returns ServFail. This is a bug (glibc #27929) and may undermine DNSSEC."*

⚠️ **Java layers its own cache on top of all of this.** `networkaddress.cache.ttl` and
`networkaddress.cache.negative.ttl` in `java.security` mean the JVM can hold a stale positive or
negative answer long after the platform resolver has been corrected. **Diagnose the layer before
you change anything**: if `getent hosts` (or an equivalent from a debug container) is right and
the JVM is wrong, the resolver is not your problem.

## Default locale and encoding — mostly defused by JEP 400

> *"In the absence of the LANG and LC_* environment variables, POSIX leaves the default locale
> (used when `""` is passed to setlocale) implementation-defined. Under glibc versions at least
> up through 2.26, this default is `"C"`. musl on the other hand always uses `"C.UTF-8"` as the
> default."*

Before JDK 18 this was a live source of "works on my Debian image" text corruption, because the
JDK derived its default charset from the environment. JEP 400 removed the bulk of it:

> *"Specify UTF-8 as the default charset of the standard Java APIs. With this change, APIs that
> depend upon the default charset will behave consistently across all implementations, operating
> systems, locales, and configurations."*

⚠️ **One residue remains, and it is filenames rather than file contents.** JEP 400 documents
`sun.jnu.encoding` as *"the name of the charset used by the implementation of `java.nio.file` when
encoding or decoding filename paths, as opposed to file contents"*, and places it among three
properties that *"remain unspecified and unsupported"* while typically tracking the platform
default. So paths containing non-ASCII characters are still locale-adjacent even though the text
you write into those files is not. **Set `LANG` explicitly in the image** if that is in scope, on
either libc — relying on an unspecified property is not better on Debian, it is merely luckier.

Note also that JEP 400 says the supported way to change the default charset is `-Dfile.encoding`
on the command line with the values `COMPAT` or `UTF-8` only, and that *"attempting to set the
property programmatically (i.e., `System.setProperty(...)`) after the Java runtime has started
does not work."*

## Two smaller differences worth knowing exist

**No lazy binding.**

> *"musl does not support lazy binding. This is both for robustness reasons (reporting failure of
> lazy binding is impossible) and because it greatly reduces the amount of fragile, arch-dependent
> code needed in the dynamic linker."*

Symbols in a shared library are resolved when it is loaded rather than at first call. For a JVM
loading a JNI library, that converts a class of "worked until we called that one method" failures
into a load-time failure — which is a **better** shape of failure, arriving earlier and with a
clearer message.

**Thread cancellation does not unwind C++.**

> *"Cancellation cleanup handling in musl has no relationship to C++ exceptions and unwinding.
> Any destructors or exception handlers present when acting on cancellation will not be run."*

musl notes that the standards make this undefined behaviour anyway and that glibc's unwinding is
an extension. It matters only if a native dependency cancels its own threads and relies on
destructors running — rare, but it is a resource-leak shape rather than a crash, so it hides.

## The one that is *not* a Java problem

musl's `iconv` has narrower coverage than glibc's, particularly for legacy East Asian encodings,
and it differs on the `//TRANSLIT` suffix and on error behaviour. **This does not affect
`java.nio.charset`.** The JDK implements its charsets in Java rather than delegating to the
platform's `iconv`; a charset missing in Java is a module question (`jdk.charsets`), not a libc
question. Stated here explicitly because chasing it costs an afternoon and finds nothing.

## Gotchas

**★ musl's 128 KB default thread stack is a native-code hazard, not a Java-code hazard.** `-Xss`
governs Java threads on every libc. What changes is native threads created without
`pthread_attr_setstacksize` — a twentieth of the stack they had on glibc. If your image has no
native dependencies, this entry does not apply to you at all; if it does, it is the first thing
to check.

**★ The native stack-overflow symptom is a SIGSEGV, not a `StackOverflowError`.** You get a
HotSpot fatal error log with native frames, which reads like a broken library. The tell is that
it only reproduces on the musl image.

**★ musl queries all nameservers in parallel and takes the first response.** Split-horizon DNS,
or a caching resolver that disagrees with upstream, produces intermittent wrong answers that
glibc's sequential behaviour concealed. Make your nameservers agree — musl's documentation
advises exactly that — rather than tuning timeouts.

**★ musl does not fall back to the search list for names at or above `ndots`.** Kubernetes writes
`ndots:5`, so a name with five or more dots is only tried in the global namespace. Fully qualify
service names. This is also faster on glibc, so it is not a musl workaround, it is a fix.

**★ musl before 1.2.4 cannot use DNS over TCP.** Responses too large for UDP are unusable, which
looks like intermittent resolution failure for exactly the records that are large — DNSSEC-signed
zones, long TXT records. Check the musl version on the base image before investigating further.

**★ Java's DNS cache sits above the resolver and can outlive the fix.**
`networkaddress.cache.ttl` and `networkaddress.cache.negative.ttl` in `java.security` are JVM
state. A negative cache entry from a transient failure can persist after DNS is healthy, and no
amount of resolver debugging will show it. Confirm from outside the JVM before concluding.

**★ JEP 400 fixed file *contents*, not file *names*.** The default charset is UTF-8 everywhere
since JDK 18, but `sun.jnu.encoding` — the path-encoding property — is documented as
*"unspecified and unsupported"*. If non-ASCII filenames are in scope, set `LANG` in the image.

**★ `-Dfile.encoding` accepts exactly two supported values.** JEP 400: `COMPAT` and `UTF-8`.
*"The treatment of values other than "COMPAT" and "UTF-8" are not specified."* A Dockerfile
carrying `-Dfile.encoding=ISO-8859-1` is relying on unspecified behaviour, on any platform.

**★ Setting `file.encoding` programmatically has never worked and still does not.** JEP 400 is
blunt: *"attempting to set the property programmatically (i.e., `System.setProperty(...)`) after
the Java runtime has started does not work."* Code that does this in a `@PostConstruct` is a
no-op that someone will trust.

**★ musl's lack of lazy binding changes *when* a broken JNI library fails, not *whether*.** It
fails at `dlopen` rather than at first call. This is an improvement; do not treat the earlier
failure as a musl bug.

**★ Do not blame musl's `iconv` for a Java charset problem.** The JDK implements charsets itself.
A missing charset in Java is about the `jdk.charsets` module.

**★ Every one of these is documented in advance.** musl publishes its differences; JEP 400
publishes the encoding rules. The failure mode on this page is never "undocumented behaviour", it
is "nobody read the page before changing the base image" — which is a review-process problem, and
the fix is to make a base-image change require the same scrutiny as a dependency upgrade.

## Interview questions

**★ A service resolves a hostname fine on Debian and intermittently fails on Alpine. Walk me
through it.**
Three layers, in order. **`ndots` and the search list**: musl only uses the search list for names
with fewer dots than `ndots`, and never falls back to it for longer names, so a partially
qualified Kubernetes name that glibc found by search can fail. **Nameserver agreement**: musl
queries all configured nameservers in parallel and accepts the first response, so a disagreeing
upstream can win a race that glibc never ran. **The JVM's DNS cache**: `networkaddress.cache.ttl`
holds answers independently of the platform, so a fixed resolver can still be serving a stale
result inside the process. The intermittency points at the second, and fully qualifying the name
usually fixes the first for free.

**★ A native library in your image crashes only on Alpine. What is the first hypothesis?**
Thread stack size. glibc derives the default from `RLIMIT_STACK` and lands at 2-10 MB; musl
documents 128 KB. Native code that creates its own threads without calling
`pthread_attr_setstacksize` gets a fraction of the stack it had. `-Xss` does not help, because
these are not Java threads — the JVM never sees them being created.

**★ Does Alpine still cause character-encoding bugs in Java?**
Far less than before JDK 18. JEP 400 specifies UTF-8 as the default charset of the standard Java
APIs *"across all implementations, operating systems, locales, and configurations"*, which
eliminates the file-content class of bug. What survives is filename encoding: JEP 400 documents
`sun.jnu.encoding` as unspecified and unsupported and typically equal to the platform default,
and musl defaults the locale to `C.UTF-8` where glibc defaults to `C`. Set `LANG` explicitly if
non-ASCII paths matter.

**★ Why does fully qualifying a Kubernetes service name help, and is it a musl-specific hack?**
It is not a hack and it is not musl-specific. Kubernetes writes `ndots:5` plus a multi-entry
search list, so an unqualified name costs several failed lookups before the successful one on
*any* libc. Fully qualifying removes those round trips and, on musl, removes the dependence on
search-list fallback behaviour that musl deliberately does not implement. It is a performance fix
that happens to also be a correctness fix.

**★ Two engineers disagree: one says musl "breaks Java threads", the other says it does not
matter at all. Who is right?**
Both are wrong in the same way — they are not distinguishing Java threads from native threads.
The JVM sets Java thread stack sizes explicitly via `-Xss`, so Java threads are unaffected. Native
threads created by JNI libraries that do not set a size inherit musl's 128 KB default. So it
matters exactly in proportion to how much native code is in your image, which is a question about
your dependency list rather than about Java.

**★ Why does musl's parallel DNS design exist if it causes this class of problem?**
Because it is faster and more robust when the nameservers agree, which is the intended
configuration. musl's rationale is that querying in parallel *"drastically improves performance
and reliability of DNS lookups"*, and its documentation states the precondition plainly: make
sure the nameservers agree. The problems attributed to musl are usually a misconfigured
`resolv.conf` that glibc's sequential fallback was papering over.

**★ Is there anything musl does *better* for a Java service?**
Two documented things. It has no lazy binding, so a JNI library with an unresolvable symbol fails
at load rather than at first call — an earlier, clearer failure. And its `getaddrinfo` does not
reproduce a glibc bug the musl page cites by number: glibc *"returns a result even if one of the
address families returns ServFail"*, which *"may undermine DNSSEC"*. Neither is a reason to
choose Alpine, but the honest comparison is not one-directional.

{/* FOOTER */}
