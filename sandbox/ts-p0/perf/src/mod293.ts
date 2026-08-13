export interface Row293 { id: string; qty: number; tags: string[] }
export function total293(rows: Row293[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample293: Row293 = { id: 'r293', qty: 293, tags: ['a', 'b'] };
