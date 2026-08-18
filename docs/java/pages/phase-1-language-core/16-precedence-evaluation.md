---
title: "Precedence and evaluation order: read it, don't rely on it"
sidebar_label: "16 · Precedence and evaluation"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the JLS SE 25 §15.7 (evaluation order),
> §15.12.4.2 (argument evaluation), §15.25 (conditional operator typing),
> §15.26.2 (compound assignment's implicit cast), and §15.23–15.24
> (conditional-and/or). The JLS derives precedence from the expression
> grammar; the consolidated table below matches the Java Tutorials' summary.

**Two different questions hide under "which happens first". *Precedence*
decides how an expression is grouped into a tree — `a + b * c` is
`a + (b * c)`. *Evaluation order* decides when each operand's code runs — and
in Java that is fully specified: **left to right, always** (§15.7), unlike
C/C++. So Java expressions are never undefined behaviour, but they can still
be misread by every human on the team. The working rule: know the table well
enough to *read* other people's code, and parenthesize your own so nobody
needs the table.**

## The precedence table, condensed to what you'll meet

Highest first; operators on one row bind equally and group left-to-right
(assignment and ternary group right-to-left):

| Level | Operators |
|---|---|
| postfix | `x++` `x--` |
| unary | `++x` `--x` `+x` `-x` `~` `!` |
| cast, `new` | `(Type) x` |
| multiplicative | `*` `/` `%` |
| additive | `+` `-` (including string `+`) |
| shift | `<<` `>>` `>>>` |
| relational | `<` `>` `<=` `>=` `instanceof` |
| equality | `==` `!=` |
| bitwise AND / XOR / OR | `&` then `^` then `\|` |
| logical AND / OR | `&&` then `\|\|` |
| ternary | `?:` |
| assignment | `=` `+=` `-=` `*=` … |

The rows that actually cause bugs:

- **Equality binds tighter than `&`**: `flags & MASK == 0` parses as
  `flags & (MASK == 0)` — a compile error for ints (the classic save), but
  for booleans it compiles and is simply wrong. Write `(flags & MASK) == 0`.
- **Shift binds looser than `+`**: `1 << 2 + 3` is `1 << 5` (32), not `4 + 3`.
- **String `+` is just additive**: `"n = " + 1 + 2` is `"n = 12"`, while
  `1 + 2 + " = n"` is `"3 = n"` — same operators, different grouping outcome
  because evaluation walks left to right.
- **Ternary sits below almost everything**: `a + b ? x : y` doesn't parse;
  `cond ? a : b + 1` is `cond ? a : (b + 1)`, not `(cond ? a : b) + 1`.

## Evaluation order: specified, left to right

The JLS guarantees (§15.7): the **left operand is fully evaluated before the
right one**, operands are evaluated before the operation applies, and method
arguments evaluate **left to right** (§15.12.4.2). So this is deterministic
in Java — the same expression that is undefined behaviour in C:

```java
int i = 0;
int[] a = {0, 0};
a[i] = i++;        // a[0] = 0 — the index i is read (0) before i++ runs? No:
                   // left-hand target a[i] is evaluated FIRST (i is 0),
                   // then the right side runs i++ (yields 0). a[0] = 0, i == 1.
```

Deterministic is not the same as readable. The guarantee exists so programs
mean one thing on every JVM; it is not an invitation to pack side effects
into one line.

Precedence and evaluation order are independent: in `f() + g() * h()` the
multiplication binds tighter, but the *calls* still run `f`, `g`, `h` — left
to right. Grouping shapes the tree; order runs the leaves.

## The traps worth knowing by name

**`i = i++` leaves `i` unchanged.** The right side evaluates first: `i++`
yields the old value and increments; then the assignment stores the old value
back, overwriting the increment. Java pins this behaviour exactly (no UB) —
it is well-defined and still always a bug.

**Compound assignment hides a cast** (§15.26.2). `E1 op= E2` is
`E1 = (T)(E1 op E2)` where `T` is `E1`'s type:

```java
byte b = 10;
// b = b + 1;    // compile error: int cannot be assigned to byte
b += 1;          // compiles — the implicit (byte) cast is built in
b += 1000;       // ALSO compiles, and silently truncates
```

The same rule makes `x *= 2 + 3` mean `x = x * (2 + 3)` — the whole right
side is one operand, whatever its internal precedence.

**The ternary re-types its arms** (§15.25). Mixed numeric arms trigger
binary numeric promotion, and mixed boxed/primitive arms trigger unboxing:

```java
Integer id = canBeNull ? getId() : null;         // fine: both arms reference-typed? No —
long n = flag ? 1 : 2L;                          // both arms promote to long
Object o = flag ? 1 : 2.0;                       // Double 1.0 or Double 2.0 — the int arm
                                                 // was promoted to double before boxing
Integer x = null;
int y = flag ? x : 0;                            // flag==true → NullPointerException:
                                                 // the mixed arms force unboxing of x
```

That last shape — a null boxed value meeting a primitive arm — is a real
production NPE ([topic 13](13-null-and-npe/README.md)) that looks nothing
like its cause.

**`&&`/`||` short-circuit; `&`/`|` don't.** `if (user != null && user.isActive())`
is the idiom precisely because the right side never runs on null. Boolean
`&`/`|` evaluate both sides always — occasionally wanted (both side effects
must happen), usually a typo.

**Assignment is an expression.** `while ((line = readLine()) != null)` is
deliberate idiom — and the parentheses are mandatory because `!=` binds
tighter than `=`. The dark side: `if (done = true)` compiles (booleans only)
and always takes the branch; `==` was meant. Yoda conditions are the C-era
workaround; in Java, just let the compiler catch it everywhere except
boolean-to-boolean.

## What to do about all of it

- **Parenthesize anything mixing operator families** — bitwise with equality,
  shifts with arithmetic, ternaries inside anything.
- **One side effect per statement.** The left-to-right guarantee makes
  `combine(i++, i++)` well-defined; nothing makes it reviewable.
- **Let the formatter/linter help**: Checkstyle and SonarQube both ship rules
  flagging assignment-in-condition and unparenthesized mixed operators.

## Gotchas

**Symptom:** `flags & CLOSED == 0` fails to compile ("bad operand types for &")
**Cause:** `==` binds tighter, producing `flags & (boolean)` — precedence, not the `&` itself
**Fix:** `(flags & CLOSED) == 0`; treat the compile error as the lucky case of a family of bugs that is silent with booleans

**Symptom:** a byte/short counter drifts wrong with no compile error anywhere
**Cause:** `+=`'s implicit cast (§15.26.2) silently truncates what plain `=` with `+` would have rejected
**Fix:** widen the variable to `int`/`long`; if the narrow type is required, add an explicit range check — see [overflow](04-operators-overflow/README.md)

**Symptom:** NPE on a line with no dereference — just a ternary
**Cause:** mixed primitive/boxed arms made the conditional unbox the boxed arm (§15.25)
**Fix:** make both arms the same type explicitly (`flag ? x : Integer.valueOf(0)` or unbox deliberately with a null check first)

**Symptom:** log line prints `id: 12` where two numbers were expected to sum
**Cause:** left-to-right string concatenation — `"id: " + 1 + 2` groups as `("id: " + 1) + 2`
**Fix:** parenthesize the arithmetic: `"id: " + (1 + 2)`

**Symptom:** `if (active = isEnabled())` always runs the branch
**Cause:** assignment (returning the assigned value) where `==` was intended — compiles because both sides are boolean
**Fix:** the comparison you meant; enable the linter rule banning assignment inside conditions

**Symptom:** `1 << bits + 1` shifts one place too far
**Cause:** `+` outranks `<<`
**Fix:** `(1 << bits) + 1` — always parenthesize shifts mixed with arithmetic

**Symptom:** null check on the right of `&` still throws NPE
**Cause:** non-short-circuit `&` evaluates both operands regardless
**Fix:** `&&` for guarding; reserve `&`/`|` for the rare "both effects required" case, with a comment saying so

## Interview questions

**★ What does Java guarantee about evaluation order that C does not?**
Operands evaluate strictly left to right, the left operand completes before
the right begins, and method arguments evaluate left to right — all specified
(JLS §15.7, §15.12.4.2). There is no undefined behaviour; `i + i++` has
exactly one meaning on every JVM. The cost of relying on it is readability,
not portability.

**★ Why does `i = i++` leave `i` unchanged, and is it defined?**
Fully defined: `i++` evaluates to the old value and increments `i`; the
assignment then writes that old value back over the increment. Java's
sequencing makes it deterministic — and it is still always a mistake to
write.

**★ What cast hides inside `b += x`, and why does it matter?**
`b += x` is `b = (typeof b)(b + x)` — the compound form inserts a narrowing
cast the plain form would reject at compile time. On `byte`/`short`/`char`
it silently truncates out-of-range results.

**★ How can a ternary throw a `NullPointerException` with no visible dereference?**
When one arm is a primitive and the other a boxed type, the conditional's
typing rules (§15.25) unbox the boxed arm; if it is null, unboxing throws.
The fix is making both arms agree in type deliberately.

**Why must `(line = read()) != null` be parenthesized?**
`!=` binds tighter than `=`, so without parentheses the expression tries to
assign the boolean comparison result to `line` and fails to compile. The
parenthesized form is accepted idiom for read-loops.

**Does precedence control which method call runs first in `f() + g() * h()`?**
No — precedence only shapes the grouping (`f() + (g() * h())`). The calls
themselves still execute left to right: `f`, then `g`, then `h`.

**When are non-short-circuit `&` and `|` on booleans correct?**
When both operands' side effects must occur regardless of the first's result
— e.g. two validations that each record errors. It's rare enough that it
deserves a comment; default to `&&`/`||`.

---

← Prev: [Naming and idiom](15-naming-idiom.md) · Next → [Phase 2 — Classes and objects](../phase-2-classes-objects/README.md)
