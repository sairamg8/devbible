---
title: "Parameter names and debug info: -parameters and -g"
sidebar_label: "02 · Parameters and debug info"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the JDK 25 `javac` tool specification
> (docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html) for
> `-parameters` and `-g`; the JDK 25 API documentation for
> `java.lang.reflect.Executable.getParameters`; the Java Virtual Machine
> Specification for the `MethodParameters`, `LocalVariableTable`,
> `LineNumberTable`, `SourceFile` and `Record` class-file attributes; the
> Spring Framework 6.1 and Spring Boot 3.2 release notes; and the Apache Maven
> Compiler Plugin and Gradle `CompileOptions` documentation.

**These two flags do not change what your code does — they change what can be
*seen* about it at runtime. `-parameters` decides whether a framework can bind
by parameter name at all, and `-g` decides whether a production stack trace
names a line or says `(Unknown Source)`. Both are capability decisions
disguised as compiler options, and both are usually discovered the hard way.**

## `-parameters`: the flag frameworks silently depend on

Java erases formal parameter names from the class file by default. Compile
`transfer(Account from, Account to, BigDecimal amount)` without `-parameters`
and `Executable.getParameters()` reports `arg0`, `arg1`, `arg2`. Adding
`-parameters` writes a `MethodParameters` attribute so the real names survive.

Be precise about the distinction people conflate:

| Attribute | Written by | Read by | Present at runtime? |
|---|---|---|---|
| `LocalVariableTable` | `-g` / `-g:vars` | debuggers, bytecode readers | yes, but it is *debug* info and absent for abstract/interface methods |
| `MethodParameters` | `-parameters` | reflection — `Executable.getParameters()` | yes, and it is the only reflective source |

That difference is exactly why the flag became mandatory in the Spring world.
Spring used to fall back to parsing `LocalVariableTable` bytecode
(`LocalVariableTableParameterNameDiscoverer`) when `MethodParameters` was
missing. **Spring Framework 6.1 removed that fallback**, and Spring Boot 3.2
ships on 6.1 — so from that version, anything that binds by parameter name
needs `-parameters`:

```java
@GetMapping("/orders")
List<Order> list(@RequestParam String status) { ... }   // name "status" needed

record OrderRequest(String sku, int qty) { }             // constructor binding
```

Without the flag you get a startup or request-time failure complaining that
the parameter name could not be determined and suggesting you compile with
`-parameters`. **Spring Boot's parent POM sets it for you** (the
`maven.compiler.parameters` property, honoured by the compiler plugin), and
the Spring Boot Gradle plugin does the equivalent — which is why the problem
almost always appears in the *one* module that does not inherit the parent, or
in a project that configures `maven-compiler-plugin` from scratch.

```xml
<properties>
  <maven.compiler.parameters>true</maven.compiler.parameters>
</properties>
```

```kotlin
tasks.withType<JavaCompile>().configureEach { options.compilerArgs.add("-parameters") }
```

Records are the partial exception: record component names live in the
`Record` attribute regardless, so record-based binding often works while a
plain constructor next to it does not — which makes the failure look
inconsistent rather than systematic. The cost of the flag is a handful of
bytes per method and slightly more information exposed to anything that can
read your jar; in practice, turn it on everywhere.

## `-g`: how readable your production stack trace is

The default is **not** "no debug info" and not "all of it": `javac` emits line
numbers and the source file name by default. That is what turns a stack frame
into `OrderService.java:142`. `-g` adds local variable names on top; `-g:none`
strips everything, and every frame in every stack trace becomes
`(Unknown Source)`.

Maven's compiler plugin passes `-g` by default (`<debug>` defaults to true),
as does Gradle (`options.debug`). Teams occasionally turn it off to shrink a
jar or to make decompiled output less pleasant. Both are bad trades: the size
saving is small, the obfuscation is nominal — a decompiler recovers structure
and logic without variable names — and the cost is paid in the exact moment
you can least afford it, reading a production stack trace with no line
numbers. If you strip anything, strip `vars` and keep `lines,source`.

## Gotchas

**Symptom:** a Spring Boot app fails at startup or on the first request with a message about not being able to determine a parameter name
**Cause:** compiled without `-parameters`; Spring Framework 6.1 removed the bytecode-parsing fallback that used to cover it
**Fix:** set `maven.compiler.parameters` / add `-parameters` to `options.compilerArgs`; if most modules work and one does not, that module is not inheriting the Spring Boot parent

**Symptom:** binding works for a `record` request body but the constructor of a neighbouring class fails to bind
**Cause:** record component names are stored in the `Record` attribute regardless of flags, so records mask a missing `-parameters`
**Fix:** set `-parameters` project-wide rather than concluding the problem is specific to that one class

**Symptom:** enabling `-g` did not restore reflective parameter names
**Cause:** `-g`/`-g:vars` writes `LocalVariableTable`, which is debug information; reflection reads `MethodParameters`, written only by `-parameters`
**Fix:** use `-parameters`; and note `LocalVariableTable` never existed for interface or abstract methods, which is why the old bytecode-parsing approach was unreliable

**Symptom:** production stack traces show `(Unknown Source)` for your own classes
**Cause:** compiled with `-g:none`, so line-number and source-file attributes were stripped
**Fix:** restore at least `-g:lines,source` — the jar-size saving is trivial next to being unable to locate a failure

**Symptom:** `-parameters` is enabled project-wide, and parameter names from a third-party library still come back as `arg0`
**Cause:** the flag affects only the code *you* compile — a dependency's class files carry whatever attributes its own build wrote
**Fix:** nothing you can do at your build level; if a framework needs names from that library's types, supply them explicitly (`@RequestParam("status")`, an explicit `@ConstructorProperties`, a wrapper type you own) rather than assuming the flag propagates

## Interview questions

**★ Why does Spring need `-parameters`, and what changed to make it mandatory?**
Java erases formal parameter names from the class file unless `-parameters`
writes a `MethodParameters` attribute; reflection has no other source for
them. Spring used to fall back to reading the `LocalVariableTable` debug
attribute from bytecode, but that fallback
(`LocalVariableTableParameterNameDiscoverer`) was removed in Spring Framework
6.1, which Spring Boot 3.2 ships on. So anything binding by name —
`@RequestParam` without an explicit value, constructor injection with multiple
candidates, property binding — now needs the flag. Spring Boot's parent POM
and Gradle plugin enable it, which is why the failure usually appears in a
module that does not inherit them.

**★ `-g:vars` and `-parameters` both "keep parameter names". What is the actual difference?**
They write different class-file attributes for different consumers.
`-g:vars` writes `LocalVariableTable`, which is debug information consumed by
debuggers and bytecode tools, and which does not exist for methods without a
body — interfaces, abstract methods. `-parameters` writes `MethodParameters`,
which is the only attribute reflection reads and which is present for every
method regardless of body. Enabling debug info does not make
`Executable.getParameters()` return real names.

**★ What is `javac`'s default for `-g`, and why does it matter operationally?**
The default is *not* "no debug info": line numbers and the source file name
are emitted, which is what makes a stack frame read `OrderService.java:142`.
`-g` adds local variable names on top; `-g:none` strips everything and every
frame becomes `(Unknown Source)`. Maven and Gradle both pass `-g` by default.
Stripping it to shrink a jar or discourage decompilation is a bad trade — the
size saving is negligible, a decompiler recovers structure anyway, and the
cost lands while you are reading a production stack trace.


**★ What does `-parameters` cost, and is there ever a case for leaving it off?**
The cost is a `MethodParameters` attribute per method — a handful of bytes,
plus the fact that real parameter names are now readable by anything that can
read your jar. That second point is the only honest argument against it, and
it is a weak one: a decompiler already recovers your structure and logic, and
if a parameter name is a secret you have a naming problem, not a compiler
problem. There is no correctness risk in enabling it, and on the Spring
Framework 6.1 line and later there is a correctness risk in *not* enabling
it. Turn it on everywhere and stop thinking about it.

---

← Prev: [Targeting a release](01-release-and-preview.md) · Index: [`javac` flags that matter](README.md) · Next → [Diagnostics and how the compiler runs](03-lint-encoding-proc.md)
