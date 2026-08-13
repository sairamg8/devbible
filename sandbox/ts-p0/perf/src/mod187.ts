export interface Row187 { id: string; qty: number; tags: string[] }
export function total187(rows: Row187[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample187: Row187 = { id: 'r187', qty: 187, tags: ['a', 'b'] };
