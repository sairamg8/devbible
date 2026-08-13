export interface Row202 { id: string; qty: number; tags: string[] }
export function total202(rows: Row202[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample202: Row202 = { id: 'r202', qty: 202, tags: ['a', 'b'] };
