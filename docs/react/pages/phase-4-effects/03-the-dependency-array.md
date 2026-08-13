---
title: "The dependency array is not a preference"
sidebar_label: "03 · The dependency array"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [`useEffect`](https://react.dev/reference/react/useEffect) §*you can't "choose"
> the dependencies* and
> [Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies).
> No sandbox script backs this page; claims are cited, not measured.

**The dependency array is not a knob for controlling how often an effect runs.
It is a declaration of what the effect reads, and it is either true or false.
Lying produces an effect that reads one particular render's values forever.**

## The rule

react.dev is unusually direct:

> **Notice that you can't "choose" the dependencies of your Effect.** Every
> reactive value used by your Effect's code must be declared as a dependency.
> Your Effect's dependency list is determined by the surrounding code.

and defines the term:

> **Reactive values** include props and all variables and functions declared
> directly inside of your component.

So the array is derived, not decided. Read the setup body, list every reactive
value it touches, and that **is** the array. There is no judgement involved —
which is exactly why a lint rule can compute it for you.

The corollary, and the sentence to remember when you want a shorter list:

> To remove a dependency, you need to **"prove" to the linter that it *doesn't
> need* to be a dependency.**

You change the code so the value is genuinely not read. You do not delete the
entry. [Topic 11](11-removing-dependencies.md) is the catalogue of legitimate
proofs.

## What "lying" actually produces

```jsx
function ChatRoom({roomId}) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, []);        // 🔴 missing 'roomId' and 'serverUrl'
}
```

The failure is not "the effect runs less often". It is:

**The effect keeps using the first render's values, forever.** The setup closed
over the `roomId` from the render that ran it, and because the dependency list
says nothing changed, React never runs it again. The user switches rooms; the
component re-renders with a new `roomId`; the connection stays pointed at the
old one.

This is the [snapshot](../phase-3-state/02-state-is-a-snapshot.md) again, made
permanent. Every render creates a new setup function closing over that render's
values — the dependency array decides **which of those functions actually runs**.
An empty array means "the first one, and only ever that one".

And the symptom is not an error. It is data that is quietly wrong, in a component
that worked when you tested it, because you tested it with one room.

## Why the linter is right and the disable comment is not

```jsx
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

This is the single most consequential line in a React codebase, because it
converts a compile-time complaint into a runtime bug that appears months later
under a condition nobody tried.

The rule ships in `eslint-plugin-react-hooks` — the same package the React
Compiler's rules now live in — and it is not a style rule. It computes the
correct array from the code. When it disagrees with you, one of two things is
true:

1. **You are wrong** — the effect does read that value, and omitting it is the
   bug above.
2. **The code is wrong** — the value should not be reactive, or the effect
   should not read it, or it should not be an effect at all.

In both cases the fix is a code change. The one situation where suppressing feels
justified — "I only want this on mount" — is precisely the case where the effect
will read stale values, so it is the worst place to suppress it.

## Why "it re-runs too often" is a different problem

Most disable comments are added because the effect re-runs more than the author
wants. That is a real problem with real fixes, and none of them is deleting a
dependency.

The `useEffect` reference names the cause:

> If some of your dependencies are objects or functions defined inside the
> component, there is a risk that they will **cause the Effect to re-run more
> often than needed.**

Because the comparison is `Object.is`, and an object or function created during
render is a new reference every time:

```jsx
function Chat({options}) {
  const config = {...options, retry: true};      // 🔴 new object each render
  useEffect(() => {
    connect(config);
  }, [config]);                                   // runs every render
}
```

The dependency is honest — the effect really does read `config`. The problem is
that `config` is unstable. Fixes, in the order the docs suggest:

- **Depend on primitives** — `[options.url, options.token]`. Best, because it
  also states the real dependency precisely.
- **Move the value inside the effect**, if nothing else uses it. Then it is not
  a dependency at all.
- **Extract non-reactive logic** with `useEffectEvent`
  ([10](10-useeffectevent.md)).
- **Use the updater form** when the effect only needs the previous state, not to
  read it ([Phase 3 · 03](../phase-3-state/03-updater-functions.md)).
- **`useMemo` / `useCallback`** — which the reference explicitly calls a *last
  resort*.

Each of those changes what the effect reads. That is what "proving it to the
linter" means.

## Values that are not reactive

Three categories are correctly absent from the array, and knowing them stops you
adding noise:

| Not a dependency | Why |
|---|---|
| Values declared **outside the component** | Module constants, imported functions — they cannot change per render |
| `set` functions from `useState` | *"The `set` function has a stable identity… If the linter lets you omit a dependency without errors, it is safe to do."* |
| `ref` objects from `useRef` | The object identity is stable across renders |
| `dispatch` from `useReducer` | Stable, same as `set` |

Note the ref subtlety: **`ref` is stable, `ref.current` is not tracked at all.**
Reading `ref.current` in an effect gives you the current value without making the
effect reactive to it — which is occasionally exactly right, and is also how
people hide dependencies illegitimately ([11](11-removing-dependencies.md)).

## Reading an effect for its dependencies

The mechanical procedure, which is what the linter does:

1. List every identifier the setup body reads.
2. Delete the ones declared inside the setup itself.
3. Delete the ones from outside the component.
4. Delete stable identities — setters, dispatch, ref objects.
5. What remains is the array.

If the result is longer than you like, that is information about the effect, not
about the array. An effect with six dependencies is usually two effects.

## Gotchas

**Symptom:** an effect uses the first render's props forever.
**Cause:** an empty array on a setup that reads reactive values.
**Fix:** declare them. If the effect must not re-run for one of them, that value
is an [effect event](10-useeffectevent.md), not an omission.

**Symptom:** the effect runs on every render.
**Cause:** an object, array or function dependency created during render.
**Fix:** depend on primitives, move it inside, or memoize as a last resort.

**Symptom:** adding the dependency the linter asked for causes an infinite loop.
**Cause:** the effect sets state that changes that dependency.
**Fix:** the updater form, or the effect should not exist
([06](06-you-might-not-need-an-effect/README.md)). Not a disable comment.

**Symptom:** the linter is silent on an effect that is obviously wrong.
**Cause:** the array is a variable rather than an inline literal, or the plugin
is not configured.
**Fix:** inline the array; check the plugin is on.

**Symptom:** a function dependency changes every render even though its body
never changes.
**Cause:** functions declared in a component are reactive values, recreated per
render.
**Fix:** move it outside the component if it reads nothing reactive, inside the
effect if only the effect uses it, or `useCallback` as a last resort.

**Symptom:** everything works, and one day a second value of the prop appears
and the feature is silently broken.
**Cause:** the classic shape — a lie that was never exercised.
**Fix:** treat a suppressed dependency as an untested code path, because that is
what it is.

## Interview questions

**★ What is the dependency array for?**
Declaring what the effect reads, so React knows when the effect must stop and
re-synchronise. react.dev's phrasing is that you cannot "choose" your
dependencies — the list is determined by the surrounding code. It is a statement
of fact that is either true or false, not a control for how often the effect
runs.

**★ What actually happens when you omit a dependency?**
The effect keeps using the values from the render that last ran it — usually the
first. Each render creates a new setup closure over that render's values, and the
dependency array decides which one runs; an empty array means only the first ever
does. So the component re-renders with a new `roomId` while the effect stays
connected to the old one. It does not error; it is quietly wrong.

**★ The effect re-runs too often. What do you do?**
Not delete a dependency. The usual cause is an object or function created during
render, which is a new reference every time under `Object.is`. Fix what the
effect reads: depend on primitives, move the value inside the effect, extract
non-reactive logic into an effect event, or use the updater form.
`useMemo`/`useCallback` are the documented last resort.

**Which values are not dependencies?**
Anything declared outside the component, `set` functions from `useState`,
`dispatch` from `useReducer`, and the `ref` object from `useRef` — all of which
have stable identities. Note that `ref.current` is not tracked at all, so reading
it does not make the effect reactive to it.

**Is `eslint-disable-next-line react-hooks/exhaustive-deps` ever right?**
Effectively never in application code. The rule computes the correct array from
your code, so a disagreement means either the effect really does read that value
— and omitting it is the stale-value bug — or the code needs restructuring. To
remove a dependency you have to prove to the linter it is not read, which means
changing the code, not the comment.

**How do you read an effect for its dependencies?**
List every identifier the setup reads, drop those declared inside the setup,
drop those from outside the component, drop stable identities like setters and
ref objects. What remains is the array. If it is uncomfortably long, that is
information about the effect — it is probably two effects.

---

← Prev: [`useEffect` anatomy](02-useeffect-anatomy.md) · Index: [Phase 4](README.md) · Next → [Cleanup](04-cleanup.md)
