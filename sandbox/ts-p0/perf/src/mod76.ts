export interface Row76 { id: string; qty: number; tags: string[] }
export function total76(rows: Row76[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample76: Row76 = { id: 'r76', qty: 76, tags: ['a', 'b'] };
