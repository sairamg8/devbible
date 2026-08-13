export interface Row32 { id: string; qty: number; tags: string[] }
export function total32(rows: Row32[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample32: Row32 = { id: 'r32', qty: 32, tags: ['a', 'b'] };
