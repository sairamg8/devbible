export interface Row198 { id: string; qty: number; tags: string[] }
export function total198(rows: Row198[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample198: Row198 = { id: 'r198', qty: 198, tags: ['a', 'b'] };
