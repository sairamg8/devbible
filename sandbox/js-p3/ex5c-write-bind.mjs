// Phase 3 topic 05 — checking the hand-written bind implementations on the page
// actually behave as claimed. Rule: nothing ships that has not run.
const show = (l, v) => console.log(`  ${String(l).padEnd(52)} ${v}`);
const fail = (l, fn) => { try { show(l, fn()); } catch (e) { show(l, `${e.constructor.name}: ${e.message}`); } };

Function.prototype.naiveBind = function (thisArg, ...boundArgs) {
  const target = this;
  return function (...callArgs) { return target.apply(thisArg, [...boundArgs, ...callArgs]); };
};

Function.prototype.myBind = function (thisArg, ...boundArgs) {
  const target = this;
  if (typeof target !== 'function') throw new TypeError('Bind must be called on a function');
  function bound(...callArgs) {
    return target.apply(new.target ? this : thisArg, [...boundArgs, ...callArgs]);
  }
  bound.prototype = Object.create(target.prototype ?? Object.prototype);
  return bound;
};

function greet(a, b, c) { return [this?.tag, a, b, c].join('|'); }
function Point(x, y) { this.x = x; this.y = y; }

console.log('\n--- ordinary calls: both implementations match native bind ---');
show('native  greet.bind({tag:"T"}, 1)(2, 3)', greet.bind({tag: 'T'}, 1)(2, 3));
show('naive   greet.naiveBind({tag:"T"}, 1)(2, 3)', greet.naiveBind({tag: 'T'}, 1)(2, 3));
show('mine    greet.myBind({tag:"T"}, 1)(2, 3)', greet.myBind({tag: 'T'}, 1)(2, 3));

console.log('\n--- with new: this is where naive diverges ---');
show('native  new (Point.bind({z:1}, 10))(20)', JSON.stringify(new (Point.bind({z: 1}, 10))(20)));
show('naive   new (Point.naiveBind({z:1}, 10))(20)', JSON.stringify(new (Point.naiveBind({z: 1}, 10))(20)));
show('mine    new (Point.myBind({z:1}, 10))(20)', JSON.stringify(new (Point.myBind({z: 1}, 10))(20)));

console.log('\n--- instanceof after new ---');
show('native  instanceof Point', new (Point.bind({z: 1}, 10))(20) instanceof Point);
show('naive   instanceof Point', new (Point.naiveBind({z: 1}, 10))(20) instanceof Point);
show('mine    instanceof Point', new (Point.myBind({z: 1}, 10))(20) instanceof Point);

console.log('\n--- what mine still does NOT reproduce ---');
show('native  .name', JSON.stringify(greet.bind({}, 1).name));
show('mine    .name', JSON.stringify(greet.myBind({}, 1).name));
show('native  .length (greet.length 3, 1 bound)', greet.bind({}, 1).length);
show('mine    .length', greet.myBind({}, 1).length);
show('native  hasOwnProperty("prototype")', greet.bind({}, 1).hasOwnProperty('prototype'));
show('mine    hasOwnProperty("prototype")', greet.myBind({}, 1).hasOwnProperty('prototype'));

console.log('\n--- the TypeError guard ---');
fail('({}).myBind()', () => { Function.prototype.myBind.call({}); return 'no error'; });
