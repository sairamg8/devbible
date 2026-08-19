---
title: "Password encoding"
sidebar_label: "11 · Password encoding"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Password
> Storage*
> (docs.spring.io/spring-security/reference/features/authentication/password-storage.html
> — `PasswordEncoder`, `DelegatingPasswordEncoder` and the `{id}` format,
> `PasswordEncoderFactories.createDelegatingPasswordEncoder()`,
> `BCryptPasswordEncoder`, `Argon2PasswordEncoder`, `SCryptPasswordEncoder`,
> `Pbkdf2PasswordEncoder`, the work-factor guidance, the deprecation of legacy
> encoders, and the Spring Security 7.0 Password4j-based encoders). Spring Boot
> 4.1.0, Spring Security 7.x, JDK 25.

**`PasswordEncoder` is a one-way function, deliberately. There is no
`decode(...)` method and its absence is the design: a system that can recover a
password is a system whose database breach hands the attacker every password,
including the ones reused on other sites. Everything else on this page follows
from that one refusal.**

## The interface, and what it does not have

> Spring Security's `PasswordEncoder` interface is used to perform a one-way
> transformation of a password to let the password be stored securely.

Two methods matter: `encode(CharSequence)` and `matches(CharSequence,
String)`. There is no way back. Verification works by encoding the presented
password the same way and comparing, never by decoding the stored value.

If a requirement says "email the user their password", the answer is not a
different encoder. It is a password reset flow, because the stored value does
not contain the password any more.

## `DelegatingPasswordEncoder` and the `{id}` prefix

The reference's framing of the problem is the useful one: no single algorithm
stays correct forever, and a system in production always has old hashes in it.
`DelegatingPasswordEncoder` "solves all of the problems by ensuring that
passwords are encoded by using the current password storage recommendations,
allowing for validating passwords in modern and legacy formats, and allowing for
upgrading the encoding in the future."

It works by storing the algorithm **in** the stored value:

```
{bcrypt}$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG
{noop}password
{pbkdf2}5d923b44a6d129f3ddf3e3c8d29412723dcbde72445e8ef6bf3b508fbf17fa4ed4d6b99ca763d8dc
```

On `matches`, the prefix selects the encoder; on `encode`, the current default is
used and its prefix written. So a table can hold three generations of hashes and
every one of them verifies.

Get one with:

```java
@Bean
PasswordEncoder passwordEncoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
}
```

**Use this, not a bare `BCryptPasswordEncoder`.** A bare encoder is one
algorithm forever: the day you want to move to argon2 you have a table of
prefix-less hashes and no way to tell them apart, and the migration turns into a
schema change plus a flag column plus code that has to guess.

⚠️ `{noop}` is the identity encoder — plaintext. It exists for tests and demos.
A `{noop}` value reaching production is a plaintext password store with a label
on it.

## The algorithms, and the honest guidance

All four are **adaptive one-way functions**: deliberately slow, with a tunable
cost.

| Encoder | Notes from the reference |
|---|---|
| `BCryptPasswordEncoder` | bcrypt; default strength 10; "deliberately slow" |
| `Argon2PasswordEncoder` | winner of the Password Hashing Competition; **needs BouncyCastle** |
| `SCryptPasswordEncoder` | memory-hard |
| `Pbkdf2PasswordEncoder` | "a good choice when FIPS certification is required" |

The current-defaults constructors are named to say when they were set:

```java
BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(16);          // strength 16
Argon2PasswordEncoder argon2 = Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
SCryptPasswordEncoder scrypt = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8();
Pbkdf2PasswordEncoder pbkdf2 = Pbkdf2PasswordEncoder.defaultsForSpringSecurity_v5_8();
```

That naming is a feature: it tells you which era's parameters you are getting,
so upgrading is an explicit change rather than an invisible one.

**Spring Security 7.0 adds a Password4j-backed set** —
`Argon2Password4jPasswordEncoder`, `BcryptPassword4jPasswordEncoder`,
`ScryptPassword4jPasswordEncoder`, `Pbkdf2Password4jPasswordEncoder` and
`BalloonHashingPassword4jPasswordEncoder` — described as thread-safe
alternatives with more configuration flexibility.

**Everything else is deprecated, and the reference says why:**

> There are a significant number of other `PasswordEncoder` implementations that
> exist entirely for backward compatibility. They are all deprecated to indicate
> that they are no longer considered secure.

`MessageDigestPasswordEncoder` (MD5, SHA-1, SHA-256), `StandardPasswordEncoder`,
`NoOpPasswordEncoder`: all in that bucket. A plain hash is fast, and fast is the
wrong property — the attacker's job is to try billions of candidates, and a
function that takes microseconds lets them.

## The work factor

> An adaptive one-way function allows configuring a "work factor" that can grow
> as hardware gets better. We recommend that the "work factor" be tuned to take
> about one second to verify a password on your system.

Three things follow, and the middle one surprises people.

- **One second is per verification, on your hardware.** It is not a constant you
  copy from a blog; measure it on the machine that will run it and re-check when
  the hardware changes.
- **It is a login-throughput budget.** One second of CPU per login means a
  handful of concurrent logins per core. Under a login storm, or a deliberate
  flood of bad passwords, that is a denial-of-service surface — which is why
  rate limiting on the login endpoint is part of choosing a work factor, not a
  separate concern. bcrypt strength is exponential: each +1 doubles the time.
- **Raising it does not re-hash anything.** Existing rows keep their old cost,
  encoded in the stored value. They upgrade when their owners log in — the next
  section.

## Upgrading an encoded password on successful login

`PasswordEncoder` has a third method, defaulting to `false`:

```java
boolean upgradeEncoding(String encodedPassword);
```

`DelegatingPasswordEncoder` returns `true` when the stored value's prefix is not
the current default. `DaoAuthenticationProvider` checks it after a successful
authentication and, if a `UserDetailsPasswordService` is available, re-encodes
the password with the current algorithm and asks you to store it:

```java
@Service
public class JdbcUserDetailsPasswordService implements UserDetailsPasswordService {

    @Override
    public UserDetails updatePassword(UserDetails user, String newPassword) {
        this.repository.updatePasswordHash(user.getUsername(), newPassword);
        return User.withUserDetails(user).password(newPassword).build();
    }
}
```

That is the whole migration story: change the default encoder, and the estate
re-encodes itself one login at a time. It only works if the presented password
is available — which it is exactly once, at login, and never afterwards, because
`ProviderManager` erases the credentials ([chunk 3](03-authentication-and-authorization.md)).

Accounts that never log in are never upgraded. That is correct and worth knowing:
the old hashes persist for dormant accounts, so a genuinely broken algorithm
needs a forced reset, not just a new default.

## The trade-off

Slow hashing is the only defence that survives a database breach, and its cost
is paid by exactly the people you want to protect: every legitimate login pays
the full work factor. Turning it down speeds up logins and speeds up the
attacker's offline cracking by the same factor, which is why the tuning target
is expressed in wall-clock time rather than as a number to minimise. And because
the cost is CPU on your servers, the security parameter and the capacity plan
are the same conversation.

## Gotchas

**Symptom:** `IllegalArgumentException` about there being no `PasswordEncoder`
mapped for the id "null".
**Cause:** A `DelegatingPasswordEncoder` reading a stored value with no `{id}`
prefix — usually pre-existing rows, or a hash written by a bare
`BCryptPasswordEncoder`.
**Fix:** Prefix the existing values (`{bcrypt}` in front of a bcrypt hash is a
correct one-off `UPDATE`), or set a default encoder for the id-less case.

**Symptom:** Login fails for a user whose password is definitely right.
**Cause:** The password was stored by a different encoder than the one verifying
— for instance encoded in a data-seeding script with a bare encoder while the
application uses a delegating one.
**Fix:** One encoder bean, used everywhere including test fixtures and seed
data.

**Symptom:** `{noop}` values in production.
**Cause:** A demo configuration or an in-memory `UserDetailsService` that
shipped.
**Fix:** Treat it as an incident: the passwords are plaintext, and they must be
reset rather than re-encoded.

**Symptom:** Argon2 fails at runtime with a missing class.
**Cause:** BouncyCastle is not on the classpath.
**Fix:** Add it, or use bcrypt.

**Symptom:** Login latency is fine in a test and terrible under load.
**Cause:** The work factor is CPU per verification, so concurrent logins
multiply it.
**Fix:** Rate-limit the login endpoint, size for peak login concurrency, and
tune the work factor with that number in hand rather than in isolation.

**Symptom:** You raised the bcrypt strength and nothing got stronger.
**Cause:** Existing hashes carry their own cost parameter; the new strength
applies to newly encoded values only.
**Fix:** Implement `UserDetailsPasswordService` so successful logins re-encode.

**Symptom:** Password upgrades never happen despite the service being present.
**Cause:** The authentication path does not go through
`DaoAuthenticationProvider` — a custom provider, or a token-based login that
never sees a raw password.
**Fix:** Upgrading is only possible at the moment a raw password is presented;
if your login does not present one, the migration has to be a forced reset.

**Symptom:** Someone proposes storing an encrypted (reversible) password so
support can read it.
**Cause:** A requirement written by someone who has not costed a breach.
**Fix:** Say no, and offer the reset flow. The key that decrypts is stored in
the same estate as the data it protects; a breach that takes one usually takes
both.

## Interview questions

**★ Why does `PasswordEncoder` have no `decode` method?**
Because it must not be possible to recover the password from stored data. The
absence is the security property: a database breach then yields hashes an
attacker has to crack individually rather than a list of usable credentials, and
password reuse across sites makes that difference enormous.

**★ What is `DelegatingPasswordEncoder` and why is it the default?**
It stores the algorithm id as a `{prefix}` on the encoded value, so old and new
formats coexist in one column. Verification picks the encoder by prefix; new
passwords are written with the current default. That is what makes changing
algorithms possible at all in a system that already has hashes in it.

**★ How do you migrate a live system from bcrypt to argon2?**
Change the delegating encoder's default id, and implement
`UserDetailsPasswordService`. On each successful login,
`DaoAuthenticationProvider` sees `upgradeEncoding` return `true`, re-encodes the
just-presented password with the new algorithm and calls `updatePassword`. The
estate migrates one login at a time; dormant accounts need a forced reset.

**★ Why can the upgrade only happen at login?**
Because it needs the raw password, and the only moment the system legitimately
has it is when the user presents it. Afterwards `ProviderManager` erases the
credentials, and the stored hash cannot be converted into another hash without
it.

**★ What is a work factor and how do you choose one?**
A tunable cost parameter that makes the function deliberately slow, raised over
time as hardware improves. The reference's guidance is to tune it so
verification takes about one second on your own system — measured there, not
copied. It is also a throughput decision: one second of CPU per login bounds
your login rate and makes the login endpoint a DoS target if unprotected.

**★ Why are `MessageDigestPasswordEncoder` and friends deprecated?**
Because a plain digest is fast, and speed is the attacker's advantage: an
offline cracker tries candidates as quickly as the function runs. Adaptive
functions exist precisely to remove that advantage, and the reference deprecates
the rest "to indicate that they are no longer considered secure".

**★ Which encoder would you pick today, and would you say so in code?**
Argon2 where BouncyCastle is acceptable, bcrypt otherwise, PBKDF2 where FIPS
certification is required. But the choice should be expressed as the *default id*
of a `DelegatingPasswordEncoder` rather than a bare encoder bean, so the answer
can change later without a data migration.

**★ Someone wants passwords stored encrypted rather than hashed so support can read them. What do you say?**
No. Encryption is reversible by design, so the decryption key becomes a single
point whose compromise exposes every password — and it lives in the same
environment as the database. Support does not need to read passwords; it needs a
reset flow, which is a smaller feature and a far smaller liability.

---

← Prev: [Claims to authorities](10-claims-to-authorities.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [CORS for an SPA](12-cors-for-an-spa.md)
