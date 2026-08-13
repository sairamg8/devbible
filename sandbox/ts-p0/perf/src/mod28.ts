export interface Row28 { id: string; qty: number; tags: string[] }
export function total28(rows: Row28[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample28: Row28 = { id: 'r28', qty: 28, tags: ['a', 'b'] };
