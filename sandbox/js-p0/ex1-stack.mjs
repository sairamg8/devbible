// Phase 0 · call stack depth and the RangeError
let depth = 0;
function recurse() { depth++; recurse(); }
try { recurse(); } catch (err) {
  console.log('caught:', err.constructor.name);
  console.log('message:', err.message);
  console.log('depth reached:', depth);
}

function level3() { throw new Error('boom'); }
function level2() { level3(); }
function level1() { level2(); }
try { level1(); } catch (err) {
  console.log('--- stack ---');
  console.log(err.stack.split('\n').slice(0, 5).join('\n'));
}
