---
title: "The residues modulo m form a ring, which is exactly the licence to reduce after every addition, subtraction and multiplication — and the reason you may never reduce before a division, because integer division is not an operation on residue classes at all"
sidebar_label: "03j · Modular arithmetic as a ring"
sidebar_position: 3.9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The ring structure of `Z/mZ`, the proof that multiplication is well defined
> on residue classes, and the counterexample showing that division is not are **textbook
> mathematics, derived on this page rather than cited** — the research bank for this phase records
> that this material has no primary source to quote. Every numeric value below is arithmetic
> performed in the text, not a measurement. **No sandbox run.**

**Modular arithmetic has one licence and one prohibition, and both are consequences of a single
algebraic fact.** The residues modulo `m` form a *ring*: addition, subtraction and multiplication
are well defined on residue classes, so reducing at any point leaves the answer unchanged — which is
not an optimisation but the only reason a chain of a million multiplications is computable at all.
Division is not a ring operation and does not survive reduction: two numbers in the same residue
class, divided by the same divisor, land in different classes, so there is nothing for `/` to mean.
Neither is exponentiation of the *exponent*, for a related reason. This page proves the licence,
demonstrates the prohibition with a two-line counterexample, and says what replaces division. The
language-level trap that sits underneath all of it — that `%` is a remainder rather than a modulus
in both TypeScript and Java, and therefore returns negative values — is
[03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md), and it causes more wrong answers than
the mathematics on this page ever will.

## Congruence, and why `+`, `−` and `×` survive reduction

`a ≡ b (mod m)` means `m` divides `a − b`. It is an equivalence relation, and it partitions the
integers into `m` classes. The claim that makes modular arithmetic usable is that the three ring
operations respect those classes: if `a ≡ a'` and `b ≡ b'`, then

```
a + b ≡ a' + b'      a − b ≡ a' − b'      a · b ≡ a' · b'      (all mod m)
```

**Addition and subtraction** are immediate: `(a + b) − (a' + b') = (a − a') + (b − b')`, and `m`
divides both bracketed terms. **Multiplication** takes one extra line, and it is worth being able to
produce it:

```
a·b − a'·b' = a·b − a'·b + a'·b − a'·b'
            = b·(a − a') + a'·(b − b')
```

`m` divides `a − a'` and `b − b'`, so it divides the whole expression. Hence `a·b ≡ a'·b'`.

The practical consequence is the one to internalise: **you may reduce at any point, as often as you
like, and the answer does not change.** So reduce constantly — after every operation — and every
intermediate stays below `m`, which is the only reason a long chain of multiplications is
computable at all.

```ts
const MOD = 1_000_000_007;
let acc = 1;
for (const factor of factors) acc = acc * factor % MOD;   // ✅ reduce every step, not at the end
```

## Division does not survive reduction

Integer division is not a ring operation, and the failure is not subtle — the residue classes do not
determine the quotient at all. Take `m = 6`:

```
10 ≡ 4 (mod 6)        because 6 divides 10 − 4
10 / 2 = 5            4 / 2 = 2            and 5 ≢ 2 (mod 6)
```

Two numbers in the same class, divided by the same divisor, land in different classes. So there is
no operation `/` on residue classes for `÷` to be, and any code that reduces operands before
dividing is computing something arbitrary. The pairing `(a % m) / (b % m)` is worse still: with
`a = 10`, `b = 5`, `m = 3`, the true `(10 / 5) mod 3` is `2`, while `(10 % 3) / (5 % 3)` is
`1 / 2`, which is `0` in integer arithmetic.

**What replaces it.** Multiplying by the *modular inverse* — the residue `b⁻¹` with `b · b⁻¹ ≡ 1`.
That exists exactly when `gcd(b, m) = 1`, which
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md) proved from Bézout, and computing it is
[07d · The modular inverse](07d-the-modular-inverse.md). The rule to carry: **there is no division
under a modulus, only multiplication by an inverse, and the inverse may not exist.**

🔴 **The exponent is not reducible either, and for a different reason.** `a^b mod m` is not
`a^(b mod m) mod m` — the exponent counts repeated multiplications and is not an element of the
ring. When `m` is prime and `a` is not a multiple of it, Fermat's little theorem does license
reducing the exponent modulo `m − 1`, and in general Euler's theorem licenses reducing it modulo
`φ(m)` when `gcd(a, m) = 1`. Both are conditional and both use a *different* modulus for the
exponent than for the base; see [07d](07d-the-modular-inverse.md) and
[03i](03i-divisor-functions-and-the-totient.md).

## Gotchas

**★ Symptom: a modular computation divides and the answer is nonsense.** Cause: integer division is
not defined on residue classes — `10 ≡ 4 (mod 6)` but `10/2 = 5` and `4/2 = 2` are in different
classes, so the operation does not survive reduction at all. Fix: multiply by the modular inverse
instead, which exists iff the divisor is coprime to the modulus:
`(a * inverseMod(b, m)) % m`, from [07d](07d-the-modular-inverse.md). If the divisor is *not*
coprime to the modulus, there is no fix — the problem has to be restructured so the division never
happens, typically by cancelling symbolically before reducing.

**★ Symptom: `a^b mod m` computed as `powMod(a, b % m, m)`.** Cause: the exponent was treated as a
ring element. It is not — it counts multiplications. Fix: reduce the exponent modulo `m − 1` only
when `m` is prime and `a` is not a multiple of it (Fermat), or modulo `φ(m)` when `gcd(a, m) = 1`
(Euler); otherwise do not reduce it at all and let binary exponentiation handle its size, which it
does in `Θ(log b)` steps —
[07 · Binary exponentiation](07-fast-exponentiation-and-the-modular-inverse.md).

**★ Symptom: the whole computation is done first and `% MOD` applied at the end.** Cause: treating
the modulus as a formatting step. Fix: reduce after every operation. The ring property is precisely
the licence to do that, and it is the only thing keeping the intermediates inside the type — an
unreduced product of a few dozen factors is not merely large, it has wrapped or been rounded, and
`% MOD` on a corrupted value is a corrupted value. Where exactly it stops fitting is
[07b · Modular exponentiation and where the product overflows](07b-modular-exponentiation-and-where-the-product-overflows.md).

**Symptom: two values that are equal modulo `m` are treated as equal.** Cause: a residue comparison
used as an identity comparison — the basis of every rolling-hash false positive. Fix: treat a
residue match as a candidate and confirm with a real comparison, or accept the collision probability
explicitly and say what it is.

**Symptom: everything is zero, and the code is correct.** Cause: `MOD` is 1. Every integer is
congruent to 0 modulo 1, so the answer genuinely is 0 — but this usually means a constant was
mis-set or a modulus was read from input without validation. Fix: assert `MOD > 1` at the boundary;
it is also the guard that `powMod` needs, since `a^0 mod 1` is `0` and not `1`.

**Symptom: `%` applied to a non-integer in TypeScript returns a fraction and nothing complains.**
Cause: `number` is a double and `%` is defined for non-integers too — `7.5 % 3` is `1.5`. Fix:
validate with `Number.isInteger` at the boundary of any modular routine. Java's static typing
removes this entirely for `int` and `long`.

## Interview questions

**★ Which operations distribute over a modulus and which do not, and why?**
Addition, subtraction and multiplication do; division does not; exponentiation of the *exponent*
does not. The reason is that the residues modulo `m` form a ring under `+`, `−` and `×`, meaning
those three are well defined on residue classes. For multiplication the one-line proof is
`a·b − a'·b' = b·(a − a') + a'·(b − b')`, and `m` divides both differences. Division fails outright:
`10 ≡ 4 (mod 6)`, yet `10/2 = 5` and `4/2 = 2` are in different classes, so the residues simply do
not determine the quotient. What replaces division is multiplication by the modular inverse, which
exists exactly when the divisor is coprime to the modulus.

**★ Can you reduce the exponent modulo the modulus?**
No. `a^b mod m` is not `a^(b mod m) mod m`, because the exponent is not an element of the ring — it
counts how many times a multiplication happens. There are two conditional rules that do let you
shrink it, and both use a different modulus for the exponent: if `m` is prime and `a` is not a
multiple of it, Fermat's little theorem gives `a^b ≡ a^(b mod (m−1)) (mod m)`; more generally, if
`gcd(a, m) = 1`, Euler's theorem gives `a^b ≡ a^(b mod φ(m)) (mod m)`. Outside those conditions the
answer is to not reduce the exponent at all — binary exponentiation is `Θ(log b)`, so even a
64-bit exponent costs about sixty multiplications.

**Why is reducing after every operation not just an optimisation?**
Because it is the only thing keeping the intermediates representable. The ring property says the
reductions are free of consequence for the *answer*; the type system says an unreduced product of
many factors will wrap in Java or lose precision in JavaScript long before the loop finishes. So
"reduce at the end" is not slower-but-correct, it is simply wrong, and the value that reaches the
final `%` is already meaningless. The two failure modes differ — Java wraps silently, JavaScript
rounds silently — and neither raises anything.

**What does `a % m === b % m` prove?**
That `a ≡ b (mod m)`, and nothing more. It does not prove `a === b`. That is exactly the property a
rolling hash trades on and exactly the property that makes a rolling hash a filter rather than a
decision: a match is a candidate that still has to be verified, or an accepted collision probability
that you should be able to state. Treating congruence as equality is how hash-based string matching
produces wrong answers on adversarial input.

{/* FOOTER */}
