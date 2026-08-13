export interface Row237 { id: string; qty: number; tags: string[] }
export function total237(rows: Row237[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample237: Row237 = { id: 'r237', qty: 237, tags: ['a', 'b'] };
