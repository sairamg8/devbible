import React, {useEffect} from 'react';
import Layout from '@theme-original/DocItem/Layout';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {hydrate, markVisited, trackOf} from '@site/src/components/StudyMode/store';

/**
 * Records that this page was opened, then renders the theme's doc layout unchanged.
 *
 * ── Why the visit is recorded HERE and not on a link click ───────────────────
 * A click handler on sidebar links would only ever see the sidebar. A reader
 * moving through 6,797 pages arrives by search, by a cross-link inside a chunk,
 * by the paginator, or by typing a URL they bookmarked — and every one of those
 * is a page genuinely read. Recording it from the page itself is the only
 * placement that counts all of them, and it costs nothing extra: `DocItem/Layout`
 * renders exactly once per doc page and never on a non-doc route.
 *
 * ── 🔴 hydrate() BEFORE markVisited(), always ────────────────────────────────
 * Reversing these two lines silently destroys the reader's history. `markVisited`
 * derives the new visited set from whatever is in the store and then WRITES that
 * set back to localStorage. Before hydration the store holds the empty default,
 * so a `markVisited` that ran first would persist a one-entry list over the real
 * one — and the `hydrate()` that followed would faithfully read that truncated
 * list back. Nothing throws, nothing warns; the reader just finds every track at
 * zero. `hydrate()` is idempotent, so paying for the call on every doc page is
 * the cheap side of this trade.
 *
 * (In practice `DocItem/Paginator` — a descendant, whose effects therefore run
 * first — has usually hydrated the store already. That is an ordering accident
 * of the React tree, not a guarantee, so this component does not lean on it.)
 *
 * ── 🔴 The effect must re-fire on a client-side route change ─────────────────
 * Docusaurus navigates without a full reload, and React keeps this component
 * mounted across doc-to-doc navigation — only the props change. A `[]` dependency
 * list would therefore record the FIRST doc of a session and nothing after it.
 * Depending on the doc id (and the two fields read alongside it) is what makes
 * every subsequent page count.
 *
 * SSR is safe without a guard here: effects do not run during the static render,
 * and both store functions bail on `typeof window === 'undefined'` regardless.
 */
export default function DocItemLayoutWrapper(props) {
  const {metadata} = useDoc();
  const {id, title, permalink} = metadata;

  useEffect(() => {
    hydrate();
    markVisited({docId: id, track: trackOf(id), title, permalink});
  }, [id, title, permalink]);

  return <Layout {...props} />;
}
