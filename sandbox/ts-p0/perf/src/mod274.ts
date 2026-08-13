export interface Row274 { id: string; qty: number; tags: string[] }
export function total274(rows: Row274[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample274: Row274 = { id: 'r274', qty: 274, tags: ['a', 'b'] };
