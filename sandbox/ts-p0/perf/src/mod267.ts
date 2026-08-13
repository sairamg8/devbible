export interface Row267 { id: string; qty: number; tags: string[] }
export function total267(rows: Row267[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample267: Row267 = { id: 'r267', qty: 267, tags: ['a', 'b'] };
