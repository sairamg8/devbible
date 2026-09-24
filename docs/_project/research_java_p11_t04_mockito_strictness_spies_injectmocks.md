---
name: research-java-p11-t04-mockito-strictness-spies-injectmocks
description: Verified Mockito 5.23.0 source research for devbible Java Phase 11 topic 04 chunks 07-strictness, 08-spies and 09-injectmocks — read from the v5.23.0 tag, not recalled. Read this before writing those three chunks.
metadata:
  type: project
---

# Java P11 T04 · Mockito 07/08/09 research — verified 2026-08-28 from tag `v5.23.0`

Gathered by an authoring fork before it was wound down at the 3-agent ceiling. **Chunks
`07-strictness.md`, `08-spies.md` and `09-injectmocks.md` are UNWRITTEN; this is their source
material.** Everything below was read from the `v5.23.0` tag, not recalled.

## Where the narrative lives

`Mockito.java` is 3,895 lines and its **numbered sections** are the primary source. Go straight
to **§13** spying on real objects · **§16** real partial mocks (carries the partial-mock
warning verbatim) · **§21** the three annotations · **§23** automatic instantiation and
constructor injection · **§40** stricter Mockito · **§46** `Mockito.lenient()`.

🔴 **§46's "elaborate example" is exactly the `@BeforeEach`-stub-used-by-only-some-tests case**
chunk 07 must cover — written by the Mockito team, so quote it rather than inventing one.

## 🔴 A correction to the dispatch brief: `Strictness` has THREE values, not four

I told the fork "the four `Strictness` values". That was wrong, and the fork caught it:

- `org.mockito.quality.Strictness` = **`LENIENT`, `WARN`, `STRICT_STUBS`** — three.
- The four-valued enum is the *nested* `org.mockito.Mock.Strictness` =
  `TEST_LEVEL_DEFAULT`, `LENIENT`, `WARN`, `STRICT_STUBS`, used only by
  `@Mock(strictness = …)` since 4.6.1, where `TEST_LEVEL_DEFAULT` means "do not override the
  test-level setting".

**Both need naming, separately.** Do not merge them.

🔴 **`MockSettings.lenient()` and `@Mock(lenient = true)` are both `@Deprecated` at 5.23.0**,
superseded by `MockSettings.strictness(Strictness)` and `@Mock(strictness = …)`. Most blog
posts still teach the deprecated form.

**Resolution order**, from `StrictnessSelector`'s javadoc: *"1st — strictness configured when
declaring stubbing; 2nd — strictness configured at mock level; 3rd — strictness configured at
test level (rule, mockito session)"*.

`MockitoExtension`'s default comes from a no-arg constructor:
`public MockitoExtension() { this(Strictness.STRICT_STUBS); }`. `@MockitoSettings` is found by
walking **up** the parent `ExtensionContext` chain, so an enclosing class's setting reaches a
`@Nested` class. `MockitoSettings.strictness()` itself defaults to `STRICT_STUBS`, so a bare
`@MockitoSettings` changes nothing.

### When `UnnecessaryStubbingException` is NOT thrown

`UniversalTestListener.reportUnusedStubs` reports only if `event.getFailure() == null` **and**
no mismatch was already reported. `MockitoExtension.afterEach` passes
`context.getExecutionException().orElse(null)` into `finishMocking(Throwable)`, whose javadoc
says *"When a failure is specified, certain checks are disabled to avoid confusion that may
arise because there are multiple competing failures."* **A test that already failed never also
reports an unnecessary stub.**

### 🔴 The non-obvious `PotentialStubbingProblem` condition

`DefaultStubbingLookupListener.potentialArgMismatches` fires only when the candidate stubbing
has the **same method name** *and* its `Location.getSourceFile()` **differs** from the
invocation's — source comment: *"If stubbing and invocation are in the same source file we
assume they are in the test code, and we don't flag it as mismatch"*. **A mock invoked
directly from the test is therefore never flagged.**

Same listener: when a stub *is* found under `STRICT_STUBS`,
`event.getInvocation().markVerified()` — that is the mechanism behind the DRY claim that you
need not verify stubbed invocations before `verifyNoMoreInteractions` (chunk `05e`).

### Quotable exception text — from the library's own `Reporter`, NOT a console

`formatUnncessaryStubbingException` joins: `"Unnecessary stubbings detected in test class: " +
testClass.getSimpleName()` / `"Clean & maintainable test code requires zero unnecessary code."`
/ `"Following stubbings are unnecessary (click to navigate to relevant line of code):"` /
`"Please remove unnecessary stubbings or use 'lenient' strictness. More info: javadoc for
UnnecessaryStubbingException class."`

`potentialStubbingProblem` joins: `"Strict stubbing argument mismatch. Please check:"` /
`" - this invocation of '<name>' method:"` / `" - has following stubbing(s) with different
arguments:"` / `"Typically, stubbing argument mismatch indicates user mistake when writing
tests."` / `"Mockito fails early so that you can debug potential problem easily."`

`UnnecessaryStubbingException`'s javadoc lists the three opt-outs *"in order of ascending
scope"* and adds a runner-only caveat: *"Mockito JUnit Runner triggers
UnnecessaryStubbingException only when none of the test methods use the stubbings"* — 🔴 **that
aggregation is the JUnit 4 runner's, not the extension's**, whose session is per test method.

## 08 · Spies — the copy, settled

`MockSettings.spiedInstance` javadoc: *"Sets the instance that will be spied. **Actually copies
the internal fields of the passed instance to the mock.**"* The copier is `LenientCopyTool`,
which walks the hierarchy to `Object`, skips `static` fields, and **swallows every failure**
with the comment *"Ignore - be lenient - if some field cannot be copied then let's be it"* —
that silent swallow is the mechanism behind "my spy did not see the field I set".

`MockUtil.createMock` prefers `mockMaker.createSpy(...)` when supported (the inline maker's
constructor-based path, for effectively-final fields) and falls back to `createMock` +
`LenientCopyTool`. **Either way it is a copy.** `spy(Object)`'s javadoc gotcha list says it
verbatim: *"Mockito \*does not\* delegate calls to the passed real instance, instead it
actually creates a copy of it."*

**The blunt javadoc to quote is §16**, and it is blunter than expected: *"Object oriented
programming is more less tackling complexity by dividing the complexity into separate,
specific, SRPy objects. How does partial mock fit into this paradigm? Well, it just doesn't…
Partial mock usually means that the complexity has been moved to a different method on the
same object. In most cases, this is not the way you want to design your application."* Plus
`spy(Class)`'s own line: *"Overusing spies hints at code design smells."*

`spy(Class)` is `mock(classToSpy, withSettings().useConstructor().defaultAnswer(CALLS_REAL_METHODS))`
— it **calls a real constructor**, which `spy(instance)` does not. `spy(T... reified)` exists
since 4.10.0, same trick as `captor()`. Gotcha: *"the spy won't have any annotations of the
spied type, because CGLIB won't rewrite them"*.

## 09 · @InjectMocks — the ordering, and a discrepancy worth stating

The javadoc says "constructor injection, property injection or setter injection in order" and
enumerates **Constructor → Property setter → Field**. The *code* has only **two** strategies:
`DefaultInjectionEngine` chains `tryConstructorInjection()` → `tryPropertyOrFieldInjection()` →
`handleSpyAnnotation()`, and `PropertyAndSetterInjection` does setter-then-field per field
internally (*"Inject mocks using first setters then fields, if no setters available"*).
**Three documented, two objects** — say so.

**The silent-failure quote:** *"If any of the following strategy fail, then Mockito **won't
report failure**; i.e. you will have to provide dependencies yourself."* And *"Mockito is not
an dependency injection framework, don't expect this shorthand utility to inject a complex
graph of objects."*

**Constructor rules, from source.** `ParameterizedConstructorInstantiator.biggestConstructor`
sorts by parameter count descending, **tie-broken by count of mockable parameter types
descending**; if the winner has zero parameters it throws *"has no parameterized constructor"*,
which `ConstructorInjection` catches, returning `false` and falling through to property/setter.
`SimpleArgumentResolver.objectThatIsAssignableFrom` returns the **first** set element
assignable to the parameter type — an **unordered `Set`**, so two mocks of the same type is
genuinely arbitrary — and **`null` if none**.

🔴 So for a **reference-typed** parameter with no matching mock the object *is* constructed
with `null` and the chain stops there. The javadoc's *"If non-mockable types are wanted, then
constructor injection won't happen"* holds for a **primitive** parameter, where reflective
`newInstance` rejects null with `IllegalArgumentException` and Mockito falls back. **State both
precisely** — the javadoc alone reads as if null is never passed.

Field/setter matching: `TypeBasedCandidateFilter` → `NameBasedCandidateFilter` (**name is
consulted only when more than one candidate survives the type filter**) → 
`TerminalMockCandidateFilter`. Fields are sorted sub-type-first then by name, **`final` and
`static` fields are skipped entirely**, and each mock is injected at most once per class.

**Annotation combinations.** `InjectMocksScanner.assertNoAnnotations` rejects `@InjectMocks`
with `@Mock` **or `@Captor`** (`unsupportedCombinationOfAnnotations`). `@InjectMocks` + `@Spy`
**is** supported via `SpyOnInjectedFieldsHandler`, which runs **after** injection and re-wraps
the already-injected instance with
`spiedInstance(instance).defaultAnswer(CALLS_REAL_METHODS).name(field.getName())` — so the
mocks are copied into the spy. Its javadoc: *"if the field is still null, then nothing will
happen there"*. §21 has the design line to quote: *"This complexity is another good reason why
you should only use partial mocks as a last resort."*

## Boundary

`@MockitoBean` / `@MockitoSpyBean` belong to **topic 05** — see
[[research-java-p11-t05-spring-test-context]]. Topic 05's directory has only chunks 01–02, so
any reference from 07–09 is bold plain text plus *(not written yet)*, never a link.

## One uncertainty stated in place in `06b` — do not "fix" it

At 5.23.0 `forClass` is `static <U, S extends U> ArgumentCaptor<U> forClass(Class<S> clazz)` —
two type variables, changed at 5.0.0. Under the old single-variable signature,
`ArgumentCaptor<List<String>> c = forClass(List.class)` was an outright incompatible-types
error. Under the two-variable signature it could **not** be settled from any primary source
whether javac emits an unchecked warning or a hard inference failure, because it turns on how
the bound `S <: U` reduces when `S` is raw `List`. **No sandbox, so no fabricated compiler
transcript.** What the page says instead is what the `captor()` javadoc *does* settle, quoted:
`forClass` for a generic type *"would require explicit casting or warning suppression"*, and
the other routes require neither.
