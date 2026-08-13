export interface Row64 { id: string; qty: number; tags: string[] }
export function total64(rows: Row64[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample64: Row64 = { id: 'r64', qty: 64, tags: ['a', 'b'] };
