export interface Row245 { id: string; qty: number; tags: string[] }
export function total245(rows: Row245[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample245: Row245 = { id: 'r245', qty: 245, tags: ['a', 'b'] };
