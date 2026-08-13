const pairs = [
  ['0 == false', 0 == false], ['0 === false', 0 === false],
  ["'' == 0", '' == 0], ["'0' == 0", '0' == 0], ["'' == '0'", '' == '0'],
  ['[] == false', [] == false], ['[] == ![]', [] == ![]], ['[] == 0', [] == 0],
  ['null == undefined', null == undefined], ['null === undefined', null === undefined],
  ['null == 0', null == 0], ['null >= 0', null >= 0], ['null > 0', null > 0],
  ['NaN == NaN', NaN == NaN], ['NaN === NaN', NaN === NaN],
  ['Object.is(NaN, NaN)', Object.is(NaN, NaN)],
  ['0 === -0', 0 === -0], ['Object.is(0, -0)', Object.is(0, -0)],
  ["'1' == 1", '1' == 1], ["[1] == 1", [1] == 1], ["[1,2] == '1,2'", [1,2] == '1,2'],
  ['{} == {}', {} === {}], ['undefined == false', undefined == false],
];
for (const [expr, r] of pairs) console.log(String(r).padEnd(6), expr);
