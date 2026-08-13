export interface Row124 { id: string; qty: number; tags: string[] }
export function total124(rows: Row124[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample124: Row124 = { id: 'r124', qty: 124, tags: ['a', 'b'] };
