export interface Row265 { id: string; qty: number; tags: string[] }
export function total265(rows: Row265[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample265: Row265 = { id: 'r265', qty: 265, tags: ['a', 'b'] };
