export interface Row62 { id: string; qty: number; tags: string[] }
export function total62(rows: Row62[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample62: Row62 = { id: 'r62', qty: 62, tags: ['a', 'b'] };
