export interface Row217 { id: string; qty: number; tags: string[] }
export function total217(rows: Row217[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample217: Row217 = { id: 'r217', qty: 217, tags: ['a', 'b'] };
