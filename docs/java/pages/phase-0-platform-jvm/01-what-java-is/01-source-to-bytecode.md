---
title: "Source to bytecode"
sidebar_label: "1 · Source to bytecode"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JVMS SE 25 §4 (the `class` file format), the
> `javac` tool reference in the JDK 25 documentation, and JEP 396/`--release`
> notes in the javac docs.

**`javac` translates `.java` source into `.class` files containing bytecode —
and that is nearly *all* it does. It checks types, erases generics, folds
constants, and writes instructions for a stack machine. It does not optimize
your loops, inline your methods, or produce anything a CPU can execute. The
performance work happens later, at run time, which is why "how do I make javac
optimize harder" is a question with no answer.**

## What comes out: one class file per type

Compile a file and you get a `.class` file for *every type declared in it*, not
one per source file:

```java
// Order.java
public class Order {
    private final List<Item> items = new ArrayList<>();

    public int totalQuantity() {
        int sum = 0;
        for (Item item : items) sum += item.quantity();
        return sum;
    }

    record Item(String sku, int quantity) {}          // → Order$Item.class

    Runnable auditor() {
        return new Runnable() {                        // → Order$1.class
            public void run() { System.out.println(items.size()); }
        };
    }
}
```

This single source file produces `Order.class`, `Order$Item.class` and
`Order$1.class`. Nested types get `Outer$Inner` names; anonymous classes get
numbers. When you open a jar and see a spray of `$` files, nothing is wrong —
that is the compilation model. (Lambdas, unlike anonymous classes, mostly do
*not* produce extra class files — they compile to an `invokedynamic`
instruction that builds the implementation at run time.)

## What bytecode is

Bytecode is the instruction set of an abstract *stack machine*: instructions
push operands onto a stack, operate on them, and pop results. There are around
200 instructions — loads and stores (`aload`, `istore`), arithmetic (`iadd`),
object operations (`new`, `getfield`), calls (`invokevirtual`,
`invokestatic`, `invokeinterface`, `invokedynamic`) and control flow.

You never write it, but you can always look at it:

```bash
javap -c Order        # disassemble — the -c flag prints the bytecode
javap -v Order        # verbose — adds the constant pool and version stamp
```

Reading `javap` output is a genuinely useful skill twice in a career: once to
win an argument about what the compiler actually generated (string
concatenation, autoboxing, synthetic bridge methods), and once to debug a
library-version mismatch at the bytecode level. You do not need to memorize
instructions — you need to know the disassembler exists.

Two properties of bytecode matter daily:

1. **It is portable by construction.** No registers, no calling convention, no
   OS assumptions — those are the JVM's problem, per platform.
2. **It is high-level enough to decompile.** Variable names in method bodies
   are gone (unless compiled with `-g`), but structure, signatures, string
   literals and constants are all recoverable. **Shipping a jar is shipping
   something close to source** — never embed secrets in one.

## The class file: anatomy and the version stamp

A class file is a precisely specified binary format (JVMS §4). The parts you
will meet in practice:

- **The magic number** — every class file starts with the bytes `CAFEBABE`.
  This is the actual specified format, not folklore.
- **Major/minor version** — which JVM generation the file requires. Java 8
  files are major version 52, and each release since adds one: 11 → 55,
  17 → 61, 21 → 65, **25 → 69**.
- **The constant pool** — every string literal, class name, method reference
  and large constant, deduplicated. `javap -v` prints it.
- **Methods with their bytecode**, fields, attributes (annotations, the
  `Record` attribute, `NestMembers`, line-number tables for stack traces).

The version stamp is the one that pages you at 2am:

```text
java.lang.UnsupportedClassVersionError: com/acme/OrderService has been
compiled by a more recent version of the Java Runtime (class file version
69.0), this version of the Java Runtime only recognizes class file versions
up to 61.0
```

Decode it with the table above: 69 means "built by JDK 25", 61 means "running
on JRE 17". The build produced artifacts newer than the runtime. The fix is
one of exactly two things: upgrade the runtime, or build for the older target
with `--release 17`.

## `--release`, not `-source`/`-target`

`javac` has two mechanisms for building on a new JDK while targeting an old
one, and only one of them is safe:

- `-source 17 -target 17` constrains *language syntax* and the *class file
  version* — but compiles against the **current** JDK's standard library. Code
  that calls a method added in 21 compiles fine and then throws
  `NoSuchMethodError` on the 17 runtime. This is a latent production failure
  that the build cannot see.
- `--release 17` compiles against the *actual Java 17 API signatures* shipped
  inside the JDK for this purpose. Calling a 21-only method is a **compile
  error**, which is where you want it.

Always `--release`. Maven's `<maven.compiler.release>` property is this flag.

## What `javac` deliberately does not do

`javac` performs almost no optimization, and this is a design decision, not a
limitation:

- It folds compile-time constants (`static final int X = 2 * 3` stores `6`;
  string literals concatenate at compile time).
- It erases generics to their bounds ([Phase 3](../../README.md) covers
  erasure properly).
- Everything else — inlining, loop unrolling, escape analysis, dead-code
  elimination — is left to the JIT at run time, which can see the *actual*
  hot paths and the *actual* CPU, and can undo its decisions when assumptions
  break.

The practical consequence: **do not contort source code for performance at
compile time.** The classic example is manually caching `list.size()` in a
loop variable "to help the compiler" — the JIT hoists that itself when it
matters. Write clear code; measure with real tools (Phase 12) before helping.

One more thing `javac` does generate: **synthetic members** — bridge methods
for generic overriding, accessors that predate nestmates, the `values()` array
copy in enums. When a stack trace or coverage report names a method you never
wrote, it is usually one of these.

## Gotchas

**Symptom:** `UnsupportedClassVersionError: class file version 69.0, this version only recognizes up to 61.0`
**Cause:** built on JDK 25, deployed to a Java 17 runtime — the class file version stamp is newer than the JVM
**Fix:** upgrade the runtime, or build with `--release 17`. The version table: 52 = 8, 55 = 11, 61 = 17, 65 = 21, 69 = 25

**Symptom:** code calling a newer API compiles cleanly, then `NoSuchMethodError` in production on the older runtime
**Cause:** `-source`/`-target` instead of `--release` — syntax was constrained but the compile ran against the new JDK's library
**Fix:** `--release N` compiles against the real Java N API and turns the runtime failure into a compile error

**Symptom:** a jar contains `Order$1.class`, `Order$Item.class` — files nobody created
**Cause:** one `.class` file is produced per *type*, not per source file; anonymous classes get numbers, nested types get `$` names
**Fix:** nothing to fix — expected output. Tooling that scans jars must expect `$` names

**Symptom:** decompiling the shipped jar recovers the code, including an embedded API key
**Cause:** bytecode preserves structure, signatures, and every string literal; decompilers reconstruct readable source
**Fix:** never put secrets in source. Config comes from the environment at run time (topic 06); obfuscation is not encryption

**Symptom:** changed a `static final` constant in a library, redeployed the library jar, dependent code still shows the old value
**Cause:** compile-time constants are *inlined into the consumer's* class file at compile time — the consumer never reads the field again
**Fix:** recompile consumers too, or don't expose mutable-in-spirit values as compile-time constants (use a method or non-final field)

**Symptom:** ran `java Order` and got the previous version's behaviour after editing `Order.java`
**Cause:** stale `.class` on the classpath — `java` runs class files, it does not check whether source changed (unless using single-file source launch)
**Fix:** rebuild; in real projects the build tool (Phase 8) owns this, which is one reason nobody invokes `javac` by hand

**Symptom:** stack trace or coverage report names `access$000` or a duplicate-looking bridge method
**Cause:** `javac` generates synthetic members — bridge methods for generics, enum plumbing
**Fix:** recognition, not repair. `javap` shows them marked `synthetic`/`bridge`

## Interview questions

**★ Is Java compiled or interpreted?**
Both, at different stages. `javac` compiles source to bytecode ahead of time;
the JVM then interprets that bytecode *and* compiles the hot parts to native
code at run time (JIT). "Compiled to an intermediate form, then dynamically
compiled the rest of the way" is the accurate sentence.

**★ What does `javac` actually optimize?**
Almost nothing — constant folding and not much else. Optimization is
deliberately deferred to the JIT, which optimizes the observed hot paths for
the actual CPU and can deoptimize when its assumptions break. This is why
source-level micro-optimization "for the compiler" is wasted effort.

**★ What is inside a `.class` file?**
The `CAFEBABE` magic number, a class file version, the constant pool
(deduplicated literals and symbolic references), field and method definitions
with their bytecode, and attributes — annotations, line-number tables,
record components. `javap -v` prints all of it.

**★ You see `UnsupportedClassVersionError` in production. What happened and what are the two fixes?**
The artifact was built for a newer Java than the runtime executing it — the
class file version stamp (say 69 = Java 25) exceeds what the JVM accepts (61 =
Java 17). Fix by upgrading the runtime or building with `--release 17`.

**★ Why is `--release` safer than `-source`/`-target`?**
`-target` fixes syntax and the class file version but compiles against the
*current* JDK's library, so calls to newer APIs become runtime
`NoSuchMethodError`s. `--release` compiles against the target version's real
API signatures, making those calls compile errors instead.

**Why does one source file produce several class files?**
Compilation is per *type*: every nested, local and anonymous class becomes its
own `Outer$...class` file. Lambdas are the exception — they compile to an
`invokedynamic` site rather than a class file.

**Can you get source code back out of a jar?**
Substantially, yes. Bytecode keeps structure, names of classes/methods/fields,
and all string literals; decompilers produce readable source (minus local
variable names and comments). Treat shipped bytecode as public and keep
secrets out of it.

**Why did a constant change in a library not take effect for its consumers?**
`static final` compile-time constants are inlined into consuming class files
by `javac`. Until consumers recompile, they carry the old value — a classic
"deployed the fix, nothing changed" incident.

---

← Index: [What Java is](README.md) · Next → [The JVM at run time](02-the-jvm-at-run-time.md)
