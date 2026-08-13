export interface Row58 { id: string; qty: number; tags: string[] }
export function total58(rows: Row58[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample58: Row58 = { id: 'r58', qty: 58, tags: ['a', 'b'] };
