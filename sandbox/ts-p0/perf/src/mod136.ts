export interface Row136 { id: string; qty: number; tags: string[] }
export function total136(rows: Row136[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample136: Row136 = { id: 'r136', qty: 136, tags: ['a', 'b'] };
