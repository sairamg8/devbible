// Requires --allow-natives-syntax
function add(a, b) { return a + b; }
for (let i = 0; i < 100000; i++) add(i, i);
%PrepareFunctionForOptimization(add);
add(1, 2); add(3, 4);
%OptimizeFunctionOnNextCall(add);
add(5, 6);
const bits = %GetOptimizationStatus(add);
console.log('optimized (numbers only):', (bits & 16) !== 0, '| status bits:', bits);
add('a', 'b');   // now polymorphic — a different shape
add({}, []);
for (let i = 0; i < 1000; i++) add(i, i);
console.log('after mixed types, still optimized:', (%GetOptimizationStatus(add) & 16) !== 0);
