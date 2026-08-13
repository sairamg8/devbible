// 50 is fine on 7.0.2; push until the limit actually bites
type Deep<N extends number[], Stop extends number> = N['length'] extends Stop ? true : Deep<[...N, 0], Stop>;
type A = Deep<[], 50>;
type B = Deep<[], 500>;
type C = Deep<[], 5000>;
declare const a: A; declare const b: B; declare const c: C;
