export interface Row183 { id: string; qty: number; tags: string[] }
export function total183(rows: Row183[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample183: Row183 = { id: 'r183', qty: 183, tags: ['a', 'b'] };
