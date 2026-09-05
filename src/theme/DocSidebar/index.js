import React from 'react';
import DocSidebar from '@theme-original/DocSidebar';
import SidebarCollapseAll from '@site/src/components/SidebarCollapseAll';
import styles from './styles.module.css';

/**
 * Wraps the theme sidebar to put the collapse/expand-all control above it.
 *
 * It goes here rather than inside DocSidebarItems because the items render inside a
 * <ul class="menu__list">, where a <div> of buttons would be invalid markup.
 *
 * The control gets its own `tools` element rather than sitting bare in the flex column.
 * Two reasons, both load-bearing:
 *
 *   1. It is the flex-none row, so the sidebar below it can be the one that grows.
 *      Selecting the sidebar by `:last-child` instead does the wrong thing on mobile,
 *      where `DocSidebar` renders nothing into this aside and the bar itself becomes
 *      the last child — and then stretches to the full 900px of the sticky viewport.
 *   2. It is a class this file owns, so the padding rules below do not depend on the
 *      theme's hashed CSS-module class names.
 */
export default function DocSidebarWrapper(props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.tools}>
        <SidebarCollapseAll />
      </div>
      <DocSidebar {...props} />
    </div>
  );
}
