export interface Row16 { id: string; qty: number; tags: string[] }
export function total16(rows: Row16[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample16: Row16 = { id: 'r16', qty: 16, tags: ['a', 'b'] };
