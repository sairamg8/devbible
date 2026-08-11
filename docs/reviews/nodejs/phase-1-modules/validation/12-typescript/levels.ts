const Level = { Info: 0, Warn: 1 } as const;
type Level = (typeof Level)[keyof typeof Level];
const current: Level = Level.Warn;
console.log(current);
