export interface Row257 { id: string; qty: number; tags: string[] }
export function total257(rows: Row257[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample257: Row257 = { id: 'r257', qty: 257, tags: ['a', 'b'] };
