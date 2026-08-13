export interface Row69 { id: string; qty: number; tags: string[] }
export function total69(rows: Row69[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample69: Row69 = { id: 'r69', qty: 69, tags: ['a', 'b'] };
