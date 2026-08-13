import assert from 'node:assert/strict';
import legacy from 'node:assert';

const show = (label, fn) => {
  try { fn(); console.log(`PASS  ${label}`); }
  catch (e) { console.log(`THROW ${label} :: ${e.code ?? e.name}: ${String(e.message).split('\n')[0]}`); }
};

console.log('--- strict vs legacy ---');
show('legacy.equal(1, "1")', () => legacy.equal(1, '1'));
show('strict.equal(1, "1")', () => assert.equal(1, '1'));
show('legacy.deepEqual({a:1}, {a:"1"})', () => legacy.deepEqual({ a: 1 }, { a: '1' }));

console.log('\n--- deepStrictEqual edge cases ---');
show('NaN vs NaN', () => assert.deepStrictEqual(NaN, NaN));
show('0 vs -0', () => assert.deepStrictEqual(0, -0));
show('{} vs Object.create(null)', () => assert.deepStrictEqual({}, Object.create(null)));
class Point { constructor(x) { this.x = x; } }
show('Point{x:1} vs {x:1}', () => assert.deepStrictEqual(new Point(1), { x: 1 }));
show('[1,2] vs [1,2] holes', () => assert.deepStrictEqual([1, , 2], [1, undefined, 2]));
show('new Date(0) vs new Date(0)', () => assert.deepStrictEqual(new Date(0), new Date(0)));
show('Map order differs', () => assert.deepStrictEqual(new Map([['a',1],['b',2]]), new Map([['b',2],['a',1]])));
show('{a:1} vs {a:1,b:undefined}', () => assert.deepStrictEqual({ a: 1 }, { a: 1, b: undefined }));

console.log('\n--- partialDeepStrictEqual ---');
console.log('typeof assert.partialDeepStrictEqual =', typeof assert.partialDeepStrictEqual);
show('partial: extra keys ignored', () =>
  assert.partialDeepStrictEqual({ id: 1, name: 'Ada', createdAt: new Date() }, { name: 'Ada' }));

console.log('\n--- throws matching ---');
show('throws with string 2nd arg (TRAP)', () => assert.throws(() => { throw new Error('boom'); }, 'boom'));
show('throws with regexp', () => assert.throws(() => { throw new Error('boom'); }, /boom/));
show('throws with object', () => assert.throws(() => { throw new TypeError('boom'); }, { name: 'TypeError', message: 'boom' }));
