export interface Row261 { id: string; qty: number; tags: string[] }
export function total261(rows: Row261[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample261: Row261 = { id: 'r261', qty: 261, tags: ['a', 'b'] };
