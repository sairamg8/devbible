---
title: "Indentation is not a style rule: it is the block structure, compiled into INDENT and DEDENT tokens before the parser sees a single statement"
sidebar_label: "1 · Syntax and indentation"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 Language Reference
> [§2 Lexical analysis](https://docs.python.org/3.14/reference/lexical_analysis.html),
> [§7 Simple statements](https://docs.python.org/3.14/reference/simple_stmts.html),
> [§8 Compound statements](https://docs.python.org/3.14/reference/compound_stmts.html),
> the [`token`](https://docs.python.org/3.14/library/token.html) and
> [`tokenize`](https://docs.python.org/3.14/library/tokenize.html) module docs, and
> [PEP 8](https://peps.python.org/pep-0008/).
> Mechanism details are read from CPython 3.14's
> [`Parser/lexer/lexer.c`](https://github.com/python/cpython/blob/3.14/Parser/lexer/lexer.c)
> and [`Parser/lexer/state.h`](https://github.com/python/cpython/blob/3.14/Parser/lexer/state.h).
> Target: **CPython 3.14**.

**In C, Java and JavaScript, indentation is a lie you tell the reader while braces
tell the compiler the truth — and the two can disagree. In Python they cannot,
because indentation *is* the message to the compiler. The tokenizer maintains a
stack of indentation columns and emits `INDENT` and `DEDENT` tokens from it; the
parser's grammar for a block literally reads `NEWLINE INDENT statement+ DEDENT`.
Everything surprising in this topic — why a mixed-tabs file dies at import time
and not at call time, why you cannot write `if x = f():`, why an unclosed bracket
reports an error forty lines below the actual mistake — falls out of that one
design decision, and out of the fact that the *tokenizer*, not the parser, is
where it happens.**

## The chunks

| # | Chunk | Covers |
|---|---|---|
| — | **This page** | Physical vs logical lines, `NEWLINE` and `NL`, the `INDENT`/`DEDENT` stack algorithm verbatim, clause/header/suite, why Python has no dangling-`else`, and the 100-level nesting cap |
| 1b | **[Tabs, spaces and `TabError`](01b-tabs-spaces-and-taberror.md)** | The two tab sizes and two stacks CPython uses to detect ambiguity, why the failure happens at *tokenize* time and takes the whole module with it, and the exact error strings |
| 1c | **[Whitespace and tooling](01c-whitespace-and-tooling.md)** | Whitespace between tokens, the numeric-literal warning, formfeed, PEP 8's indentation rules, and the three-layer `.editorconfig`/`ruff`/pre-commit setup that ends the argument |
| 1d | **[Statements vs expressions](01d-statements-vs-expressions.md)** | Simple vs compound statements, expression statements, why `if x = f():` cannot parse, annotated assignment, chained assignment, and the walrus operator's justification |
| 1e | **[Line joining and semicolons](01e-line-joining-and-semicolons.md)** | Backslash continuation and its four restrictions, bracket continuation and why it wins, the `assert`-tuple trap, unclosed brackets, semicolons and one-line suites |
| 1f | **[Comments and encoding](01f-comments-and-encoding.md)** | `#` and what it ends, comment-only and blank lines producing no token, PEP 263 encoding declarations, BOMs, and why `# -*- coding: utf-8 -*-` is now noise |
| 1g | **[Syntax errors and 3.14's messages](01g-syntax-errors-and-messages.md)** | The `SyntaxError`/`IndentationError`/`TabError` hierarchy and its attributes, the full table of CPython's indentation messages, 3.14's new diagnostics, and PEP 758 |
| 1h | **[Soft keywords and the REPL](01h-soft-keywords-and-the-repl.md)** | Why `match`, `case`, `type` and `_` are not reserved, how the PEG parser resolves them, and how `'single'` mode makes the prompt behave unlike a file |

## Physical lines, logical lines, and the one token that separates statements

The reference is precise about the two-level structure, and the distinction is
load-bearing for everything else:

> *"A Python program is divided into a number of logical lines."*

> *"The end of a logical line is represented by the token `NEWLINE`. Statements
> cannot cross logical line boundaries except where `NEWLINE` is allowed by the
> syntax (e.g., between statements in compound statements). A logical line is
> constructed from one or more physical lines by following the explicit or
> implicit line joining rules."*

A *physical* line is what your editor shows and what `\n` ends. A *logical* line
is what the grammar consumes. `NEWLINE` is a real token in the token stream, not
an absence of one — which is why "just delete the newline" is not a refactor you
can always perform, and why `tokenize` has a *second* newline token for the ones
that do not count:

> *"`token.NL` — Token value used to indicate a non-terminating newline. NL
> tokens are generated when a logical line of code is continued over multiple
> physical lines. The parser ignores NL tokens."*

So the token stream carries three kinds of structural whitespace signal, and only
one of them means "statement ended": `NEWLINE` (logical line over), `NL` (physical
line break the parser discards), and the `INDENT`/`DEDENT` pair.

## The indentation stack, in the reference's own words

This is the single most useful paragraph in §2, and it is worth reading as an
algorithm rather than as prose:

> *"The indentation levels of consecutive lines are used to generate `INDENT` and
> `DEDENT` tokens, using a stack, as follows. Before the first line of the file is
> read, a single zero is pushed on the stack; this will never be popped off again.
> The numbers pushed on the stack will always be strictly increasing from bottom to
> top. At the beginning of each logical line, the line's indentation level is
> compared to the top of the stack. If it is equal, nothing happens. If it is
> larger, it is pushed on the stack, and one `INDENT` token is generated. If it is
> smaller, it must be one of the numbers occurring on the stack; all numbers on the
> stack that are larger are popped off, and for each number popped off a `DEDENT`
> token is generated. At the end of the file, a `DEDENT` token is generated for
> each number remaining on the stack that is larger than zero."*

Four consequences people rediscover the hard way:

1. **Indenting deeper always produces exactly one `INDENT`, no matter by how
   much.** Four spaces and forty spaces are the same event. The absolute column is
   only ever compared, never divided by four. Python has no notion of "one level"
   as a fixed width — that is entirely a PEP 8 convention.
2. **Dedenting can produce many `DEDENT`s at once**, closing several blocks in one
   line break.
3. **Dedenting to a column that is not already on the stack is an error**, not a
   new level. This is the case the reference covers with *"it must be one of the
   numbers occurring on the stack"*, and CPython turns it into an
   `IndentationError` with the message `unindent does not match any outer
   indentation level` (raised from `Parser/pegen_errors.c`).
4. **End of file closes every open block.** A file may end mid-block with no
   blank line and no dedent, and it parses.

```python
def f(x):
    if x:
        return 1
    return 0
# EOF here: two DEDENTs are synthesised, one for the `if` suite,
# one for the function body.
```

The middle `return 0` is the interesting one: dedenting from column 8 to column 4
pops one entry and emits one `DEDENT`, and column 4 is still on the stack, so it
is legal. Dedenting to column 2 instead would pop *both* 8 and 4, land on 0, and
fail the "must be one of the numbers on the stack" check.

## Clause, header, suite: the shape every block shares

§8 defines the vocabulary that the rest of the language reference uses without
re-explaining:

> *"A compound statement consists of one or more 'clauses.' A clause consists of a
> header and a 'suite.' The clause headers of a particular compound statement are
> all at the same indentation level. Each clause header begins with a uniquely
> identifying keyword and ends with a colon. A suite is a group of statements
> controlled by a clause."*

And the grammar for a suite:

```text
suite: stmt_list NEWLINE | NEWLINE INDENT statement+ DEDENT
```

Read that right-hand alternative slowly: `INDENT` and `DEDENT` are *grammar
symbols*. The parser does not measure whitespace; it matches tokens the tokenizer
already produced. That is the whole trick, and it is why indentation errors are
detected before any name resolution, any import, any type check.

The colon is not decoration either — it is what tells the parser a header has
ended and a suite begins. Omit it and 3.14 says so directly: the grammar file
carries dedicated rules raising `expected ':'` for `if`, `elif`, `with`, `except`,
`match` and `case` headers.

Note also *"The clause headers of a particular compound statement are all at the
same indentation level."* An `else:` that is one space off from its `if:` is not a
style problem; it is either attached to a different statement or a hard error.

## Why Python cannot have a dangling `else`

The classic C ambiguity — which `if` does this `else` belong to? — is not resolved
by a rule in Python. It is made unrepresentable. The reference is blunt about the
one-line form:

> *"The following is illegal, mostly because it wouldn't be clear to which `if`
> clause a following `else` clause would belong:"*
>
> ```python
> if test1: if test2: print(x)
> ```

Only the indented form of a suite may contain nested compound statements:

> *"A suite can be one or more semicolon-separated simple statements on the same
> line as the header, following the header's colon, or it can be one or more
> indented statements on subsequent lines. Only the latter form of a suite can
> contain nested compound statements."*

So a nested `if` must be indented, and once it is indented, the `else`'s column
says unambiguously which header it pairs with. The ambiguity is deleted from the
grammar rather than patched with a precedence rule. This is the strongest single
argument for the whole design, and it is the answer to "why not braces?".

## There is a hard nesting limit, and it is 100

CPython's lexer stores the indentation stack in a fixed-size array:
`#define MAXINDENT 100 /* Max indentation level */` in
`Parser/lexer/state.h`. Exceeding it sets the `E_TOODEEP` error code, which
`Parser/pegen_errors.c` turns into an `IndentationError` with the message
`too many levels of indentation`. The same header caps bracket nesting at
`MAXLEVEL 200` and f-string nesting at `MAXFSTRINGLEVEL 150`.

These are CPython implementation limits, not language rules — the reference states
no maximum. You will only meet them with generated code, and meeting one is a
signal that the generator, not the limit, is wrong.

## Gotchas

### A dedent to "somewhere in between" is an error, not a new block

**Symptom.** `IndentationError: unindent does not match any outer indentation
level`, pointing at a line that looks fine in isolation.
**Cause.** The stack rule. The line's column is smaller than the top of the stack
but is not equal to any entry on it, so there is no block for it to belong to.
This is common after deleting a line that used to establish an intermediate level,
or after reindenting a `try`/`except` by hand.
**Fix.** Align the line with an existing enclosing header, not with an arbitrary
column.

```python
def f(items):
    for item in items:
        if item:
            process(item)
      # <- column 6 was never on the stack: 0, 4, 8, 12 were
        cleanup(item)      # column 8: legal, closes the `if`
    return True            # column 4: legal, closes the `for`
```

### Consistent-but-weird indentation compiles fine

**Symptom.** A file indented by 1 space, or 3, or with each block a different
width, passes `python -c "import mod"` without complaint.
**Cause.** The tokenizer only ever compares columns to a stack. It has no concept
of a standard width, so no "wrong" width exists.
**Fix.** This is a lint and formatter concern, not a compiler one — PEP 8's *"Use
4 spaces per indentation level"* is enforced by `ruff`/`black`, not by CPython.
Do not conclude from "it runs" that the indentation is right.

### `INDENT` after a header is required, and its absence has its own message

**Symptom.** `IndentationError: expected an indented block after 'if' statement on
line 12`.
**Cause.** The grammar's `suite` rule needs `NEWLINE INDENT statement+ DEDENT`; a
header followed by a same-column line matches nothing. CPython's `Grammar/python.gram`
has a dedicated failure rule per keyword, which is why the message names the
keyword and the header's line number.
**Fix.** Indent the body, or write `pass` if the block is genuinely empty — Python
has no empty suite.

```python
if condition:
    pass          # required: there is no `if condition: ;`
```

## Interview questions

**Why does Python use indentation instead of braces, and what does that actually
buy?**
It removes an entire class of defect where the visual structure and the compiled
structure disagree — the `goto fail` shape of bug, where an unbraced `if` body
silently contains one statement while the indentation claims two. It also removes
the dangling-`else` ambiguity from the grammar rather than resolving it with a
precedence rule, because a nested compound statement can only appear in an
indented suite, and the `else`'s column then determines its owner unambiguously.
The cost is that whitespace becomes semantically significant, so tools that mangle
whitespace — bad copy-paste, some email clients, a diff applied with fuzz — can
change program meaning.

**Walk me through what the tokenizer does with indentation.**
Before reading the first line it pushes 0 onto a stack. At the start of every
logical line it computes the line's indentation column and compares it with the
top of the stack: equal means emit nothing, larger means push and emit one
`INDENT`, smaller means pop every larger entry, emitting one `DEDENT` per pop, and
then require that the resulting top equals the line's column. At EOF it emits a
`DEDENT` for every remaining entry above zero. The parser then matches those as
ordinary grammar tokens — its rule for a block is literally
`NEWLINE INDENT statement+ DEDENT`.

**If I indent one block by 4 spaces and the next by 12, is that an error?**
No. Only the comparison matters, never the difference. Both produce exactly one
`INDENT`. It is a PEP 8 violation that `ruff` will flag, and a compiler
non-event.

**Why does Python have a `pass` statement at all?**
Because a suite must contain at least one statement — the grammar is
`statement+`, not `statement*`. There is no way to write an empty block, so a
no-op statement is needed to say "deliberately nothing". `...` (`Ellipsis`) is
sometimes used the same way in stubs and protocols; it is an expression statement
rather than a keyword, but it satisfies the same grammatical requirement.

**Is there a limit to how deeply I can nest blocks?**
Not in the language, but yes in CPython: `MAXINDENT` is 100 in
`Parser/lexer/state.h`, and exceeding it raises `IndentationError: too many levels
of indentation`. Bracket nesting is capped separately at 200. You reach these only
with machine-generated source.

**What is the difference between `NEWLINE` and `NL` in the token stream?**
`NEWLINE` marks the end of a *logical* line and is meaningful to the parser. `NL`
marks a physical line break that does not end a logical line — inside bracketed
continuations, and on blank or comment-only lines — and the docs state plainly
that the parser ignores it. You only see `NL` if you are using the `tokenize`
module; it never reaches the grammar.

---

← Prev: [Bytecode inspection with `dis`](../../phase-0-runtime/12-dis-bytecode/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Tabs, spaces and `TabError`](01b-tabs-spaces-and-taberror.md)
