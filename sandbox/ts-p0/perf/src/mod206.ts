export interface Row206 { id: string; qty: number; tags: string[] }
export function total206(rows: Row206[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample206: Row206 = { id: 'r206', qty: 206, tags: ['a', 'b'] };
