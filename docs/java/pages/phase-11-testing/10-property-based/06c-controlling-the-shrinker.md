---
title: "Three settings decide what the shrinker does to a failing property — the mode, the bound it runs under, and the target it shrinks numbers toward — and the only one most teams ever need is the last, because shrinkTowards is what stops every failure report in a domain whose neutral value is not zero from reading like a boundary bug"
sidebar_label: "06c · Controlling the shrinker"
sidebar_position: 32
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Optional @Property
> Attributes*, *Switch Shrinking Off*, *Switch Shrinking to Full Mode*, *Change the Shrinking
> Target*, *Property Defaults* and *jqwik Configuration*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1 javadoc**
> for `Arbitraries` numeric arbitraries and `shrinkTowards`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Arbitraries.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The configuration block is reproduced from
> the guide's own documented defaults; no timing or step count here is a measurement taken here.

**[06](06-shrinking.md) covered the mechanism and [06b](06b-what-shrinking-costs-you.md) covered
what it costs. This page is the small surface you can actually turn: one `@Property` attribute
with three values, two configuration keys, and one arbitrary-level setting that is worth reaching
for far more often than the other two combined.**

## `ShrinkingMode` — three values, and you want the default

The `shrinking` attribute of `@Property` takes an enum, documented as:

> - *"`ShrinkingMode.OFF`: No shrinking at all"*
> - *"`ShrinkingMode.FULL`: Shrinking continues until no smaller value can be found that also
>   falsifies the property. This might take very long or not end at all in rare cases."*
> - *"`ShrinkingMode.BOUNDED`: Shrinking is tried for 10 seconds maximum and then times out. The
>   best shrunk sample at moment of time-out will be reported. This is the default."*

And the guide gives the decision rule in one sentence, which is unusually direct for
documentation:

> *"Most of the time you want to stick with the default. Only if bounded shrinking is reported -
> look at a falsified property's output! - should you try with `ShrinkingMode.FULL`."*

Read that as an instruction about *evidence*: do not switch to `FULL` because a report looks
big, switch because the output told you the search was cut short. `BOUNDED` degrades gracefully
by design — it reports the best candidate it had when the clock ran out, so a timed-out shrink
still gives you something smaller than the original.

```java
@Property(shrinking = ShrinkingMode.FULL)
void aPropertyWhoseShrinkingGetsCutShort(@ForAll("orders") Order order) { ... }
```

`OFF` exists for a narrower case than people use it for. The guide's framing:

> *"Sometimes shrinking takes a really long time or won't finish at all (usually a jqwik bug!).
> In those cases you can switch shrinking off for an individual property"*

— with the guide's own example being a property over `List<Set<String>>` parameters, a nesting
depth where the candidate space explodes. Note the parenthesis: the guide treats a
non-terminating shrink as *its* bug, not yours. `OFF` is the workaround while that is true, not a
performance setting.

## The two bounds, and a discrepancy worth knowing about

The documentation describes the `BOUNDED` limit in two different units in two different places.
The attribute reference and the configuration file both say **ten seconds**:

```properties
jqwik.shrinking.default = BOUNDED            # BOUNDED, FULL, or OFF
jqwik.shrinking.bounded.seconds = 10         # The maximum number of seconds to shrink if
                                             # shrinking behaviour is set to BOUNDED
```

But the section that tells you when to switch to `FULL` describes the message you are looking for
as a **step** count:

> *"Sometimes you can find a message like `shrinking bound reached = after 1000 steps.` in your
> testrun's output. This happens in rare cases when jqwik has not found the end of its search for
> simpler falsifiable values after 1000 iterations."*

⚠️ **I could not settle from the documentation whether these are two independent limits — a
ten-second clock and a thousand-step counter — or one limit described loosely in the other's
terms.** Treat both as real: the practical takeaway is unaffected, because the action is the same
either way. Look for the words *"shrinking bound reached"* in the output, and only then reach for
`FULL`. The exact unit matters only if you intend to raise `jqwik.shrinking.bounded.seconds`, and
in that case raise it and re-read the output rather than assuming which bound you hit.

## Setting it for more than one property

`@PropertyDefaults` sets the mode for a whole container, and an individual `@Property` overrides
it:

```java
@PropertyDefaults(tries = 10, shrinking = ShrinkingMode.FULL)
class ShrinkingHeavyProperties {

    @Property                                  // inherits FULL
    void one(@ForAll String s) { ... }

    @Property(shrinking = ShrinkingMode.OFF)   // overrides it
    void two(@ForAll List<Set<String>> nested) { ... }
}
```

For a whole project, `jqwik.shrinking.default` in `junit-platform.properties` moves the baseline.
Both are worth knowing and neither is worth using casually: a project-wide `OFF` is a decision
to make every future failure report harder to read, taken once, by whoever was annoyed that
afternoon.

## `shrinkTowards` — the setting you will actually use

By default:

> *"shrinking of numbers will move towards zero (0). If zero is outside the bounds of generation
> the closest number to zero - either the min or max value - is used as a target for shrinking."*

That default is right for quantities and wrong for almost every other numeric domain — a
temperature in Kelvin, an HTTP status code, a year, a port number, a frequency. In all of those,
zero (or the range's lowest legal value) is not the "neutral" case and a report that shrinks to
it points at the wrong place. The guide's example is a signal generator with a standard frequency
of 50 hz varying by ±5:

```java
@Provide
Arbitrary<List<Signal>> signals() {
    Arbitrary<Long> frequencies =
        Arbitraries
            .longs()
            .between(45, 55)
            .shrinkTowards(50);

    return frequencies.map(f -> Signal.withFrequency(f)).list().ofMaxSize(1000);
}
```

Without `shrinkTowards(50)`, every falsified scenario shrinks to 45 and every report reads as a
bug at the bottom of the range — including the ones that are not. With it, a report that *does*
say 45 is now evidence, because the shrinker had to travel away from the centre to get there.
That is the real value of the setting: it makes the minimal counter-example informative rather
than structural.

The guide's own justification names the general case rather than the example:

> *"There are cases, however, when you'd like jqwik to choose a different shrinking target,
> usually when the default value of a number is not 0."*

⚠️ **Scope:** *"Currently shrinking targets are supported for all number types."* There is no
equivalent for strings, collections or enums — for those, the shrink direction is fixed, and the
lever you have is the ordering discussed in [06 · Shrinking](06-shrinking.md) (first element of
`Arbitraries.of`, first constant of an enum, start of a `frequency` list).

## Where this connects

- The mechanism these settings govern is [06 · Shrinking](06-shrinking.md); what it costs is
  [06b · What shrinking costs you](06b-what-shrinking-costs-you.md).
- The other `@Property` attributes, and which of them have project-wide defaults, are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md).
- `junit-platform.properties` as a whole, including the keys that govern reproducibility, is
  [07 · Reproducibility](07-reproducibility.md).
- Constraining a numeric arbitrary in the first place is
  [05b · Constraining generation](05b-constraining-generation.md).

## Gotchas

**★ `ShrinkingMode.OFF` does not make a failing property fast — it makes it *report the original random sample*, which is usually a worse trade than the time it saves.**
The time saved is bounded by ten seconds per failing property under the default mode. The cost is
unbounded: every future failure of that property arrives as whatever the generator drew, which on
a realistic aggregate generator is a value nobody will read. Teams reach for `OFF` when a red
build is slow, and the red build is slow because something is broken — the state in which
readable failures are worth the most. If a property genuinely cannot be shrunk in reasonable
time, the guide's framing says to suspect a jqwik bug and the practical move is to simplify the
generator, not to stop shrinking.

**★ `shrinkTowards` changes the *distribution*, not only the report — it is documented as a mean, not merely a shrink target.**
The javadoc for the setting says the value *"is supposed to be the 'center' of all possible values
used for shrinking **and as a mean for random distributions**"*. So setting it is a generation
decision as well as a reporting one: values cluster around the target. That is usually what you
want — traffic really does cluster around 50 hz — but it means `shrinkTowards` is not a free
cosmetic improvement to failure reports. If you need the shrink target moved and the distribution
left uniform, say so explicitly rather than assuming this setting did it.

**★ A project-wide `jqwik.shrinking.default = FULL` can turn one pathological property into a build that never finishes.**
`FULL` is documented as running *"until no smaller value can be found"*, with the explicit caveat
*"This might take very long or not end at all in rare cases."* Applied per-property after seeing
*"shrinking bound reached"*, that risk is scoped to one test you are actively debugging. Applied
project-wide it is scoped to whichever property someone writes next over a deeply nested type. The
default exists because a bounded search that reports its best answer is the right behaviour for
an automated suite; `FULL` is a debugging tool.

**★ Raising `jqwik.shrinking.bounded.seconds` multiplies across failing properties, and the multiplier is the number of things broken.**
The bound is per property, not per run. Ten seconds against forty properties is a bound of nearly
seven minutes on the day everything is red — which is exactly the day someone is watching the CI
log. Raising it to sixty because one property needed more is a decision about the worst case, and
the worst case is not the one property you were debugging.

**★ Enum ordering and `Arbitraries.of` ordering cannot be overridden with a setting, so the "shrink target" for non-numeric types is a code-structure decision made once.**
There is no `shrinkTowards` for enums, strings or lists — the guide limits the feature to number
types. The equivalent lever is declaration order, which means it is set by whoever wrote the enum,
possibly years earlier and for unrelated reasons, and changing it later is a refactor with
unrelated blast radius. This is worth raising in review of new enums that will be generated over:
the first constant is the one every future failure report will start from.

**★ A `@PropertyDefaults` shrinking mode is inherited by nested containers, so a `FULL` set for one debugging session can outlive the session in a class nobody re-reads.**
The mechanism is ordinary annotation inheritance down the container hierarchy, and the guide's
example shows exactly the shape — a default set at container level, overridden on one property.
The hazard is temporal rather than technical: `FULL` added while debugging is invisible in the
diff of the property that motivated it, because it lives on the class. When you set it, set it on
the property you are debugging.

## Interview questions

**★ A property's failure output says the shrinking bound was reached. What does that mean and what do you do?**
It means the default `BOUNDED` mode stopped searching before it had exhausted the candidate space,
and reported the best sample it had at that moment — so the value in the report is smaller than
the original but not necessarily minimal. The guide's advice is to treat that message as the one
piece of evidence that justifies switching to `ShrinkingMode.FULL`, which runs *"until no smaller
value can be found"* with the explicit warning that it may not terminate. I would do that on the
one property, not project-wide, and I would treat it as a debugging step rather than a permanent
setting. I would also read it as a hint about the generator: a search that cannot finish inside
the bound usually means deep nesting, a large branching factor, or an unshrinkable component
keeping the sample big — and fixing that helps every future failure of that property, whereas
raising the bound only helps this one.

**★ When would you set `shrinkTowards`, and what are you actually buying?**
Whenever zero is not the neutral value of the quantity — which is most numeric domains outside
counts and sizes. Ports, years, status codes, temperatures on any scale with an offset, a
frequency around a nominal value. What I am buying is that the minimal counter-example carries
information. By default every failure shrinks to the bottom of the range, so every report looks
like a boundary bug and I cannot distinguish "this really only fails at the minimum" from "the
shrinker had nowhere else to go". With the target set to the domain's centre, a report that still
names the minimum is genuine evidence about the minimum. The thing to be aware of is that the
setting is documented as the mean of the random distribution too, so it also changes what gets
generated — clustering values around the target. That is normally desirable, but it means I would
not describe it to a colleague as a purely cosmetic change to failure reports.

**★ Someone proposes putting `jqwik.shrinking.default = OFF` in `junit-platform.properties` because the red builds are slow. How do you respond?**
I would push back, and on the trade rather than the taste. The saving is bounded — ten seconds per
failing property under the current default — and it is paid for with an unbounded cost, because
every future failure in the project arrives as an unshrunk random sample. Those are the reports
people give up on, and a property nobody can triage gets quarantined and then deleted, so the
end state of that setting is fewer properties, not faster ones. Then I would look at what is
actually slow: if a single property execution is expensive because it touches a container or
builds a context, the shrinker is multiplying a cost that was already wrong and the property
wants restructuring; if executions are cheap and the search is simply long, that is a generator
shape problem — nesting, branching factor, or an unshrinkable component — and it is fixable at the
source. If after all that one specific property still cannot shrink in reasonable time, `OFF` on
that property, with a comment saying why, is a defensible local decision. Project-wide it is not.

{/* FOOTER */}
