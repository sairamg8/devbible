export interface Row182 { id: string; qty: number; tags: string[] }
export function total182(rows: Row182[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample182: Row182 = { id: 'r182', qty: 182, tags: ['a', 'b'] };
