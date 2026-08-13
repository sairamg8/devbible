export interface Row251 { id: string; qty: number; tags: string[] }
export function total251(rows: Row251[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample251: Row251 = { id: 'r251', qty: 251, tags: ['a', 'b'] };
