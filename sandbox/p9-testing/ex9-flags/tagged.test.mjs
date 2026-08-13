import { test } from 'node:test';
test('fast unit thing', { tag: 'unit' }, () => {});
test('slow db thing', { tag: 'integration' }, () => {});
test('array tags', { tag: ['unit', 'fast'] }, () => {});
test('plural key', { tags: ['unit'] }, () => {});
test('untagged thing', () => {});
