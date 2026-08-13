export interface Row284 { id: string; qty: number; tags: string[] }
export function total284(rows: Row284[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample284: Row284 = { id: 'r284', qty: 284, tags: ['a', 'b'] };
