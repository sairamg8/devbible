import React from 'react';
import clsx from 'clsx';
import DocSidebar from '@theme-original/DocSidebar';
import SidebarCollapseAll from '@site/src/components/SidebarCollapseAll';
import styles from './styles.module.css';

/**
 * Wraps the theme sidebar to put the collapse/expand-all control above it.
 *
 * It goes here rather than inside DocSidebarItems because the items render inside
 * a <ul class="menu__list">, where a <div> of buttons would be invalid markup.
 *
 * The control gets its own `tools` element rather than sitting bare in the flex
 * column. Two reasons, both load-bearing:
 *
 *   1. It is the flex-none row, so the sidebar below it can be the one that grows.
 *      Selecting the sidebar by `:last-child` instead does the wrong thing on
 *      mobile, where `DocSidebar` renders nothing into this aside and the bar
 *      itself becomes the last child — and then stretches to the full height of
 *      the sticky viewport.
 *   2. It is a class this file owns, so the padding rules do not depend on the
 *      theme's hashed CSS-module class names.
 *
 * ── `isHidden` ───────────────────────────────────────────────────────────────
 * The theme hides the collapsed sidebar by shrinking the aside to
 * `--doc-sidebar-hidden-width` (30px) with `clip-path: inset(0)`, and separately
 * setting `opacity: 0; visibility: hidden` on ITS OWN inner sidebar div. Anything
 * this component adds above that div is not covered by it, and survives the
 * collapse as a clipped sliver — which is exactly what the technology rail did
 * before it was removed, and what this control bar would do too.
 *
 * `isHidden` is a real prop on `DocSidebar`, passed from `DocRoot/Layout/Sidebar`,
 * and the `ExpandButton` that brings the sidebar back is a SIBLING of this
 * component rather than a child. So the whole wrapper can take the same treatment
 * and the toggle stays reachable.
 */
export default function DocSidebarWrapper(props) {
  return (
    <div className={clsx(styles.wrapper, props.isHidden && styles.wrapperHidden)}>
      <div className={styles.tools}>
        <SidebarCollapseAll />
      </div>
      <DocSidebar {...props} />
    </div>
  );
}
