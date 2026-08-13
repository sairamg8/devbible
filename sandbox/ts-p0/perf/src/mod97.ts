export interface Row97 { id: string; qty: number; tags: string[] }
export function total97(rows: Row97[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample97: Row97 = { id: 'r97', qty: 97, tags: ['a', 'b'] };
