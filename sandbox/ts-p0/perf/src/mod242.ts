export interface Row242 { id: string; qty: number; tags: string[] }
export function total242(rows: Row242[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample242: Row242 = { id: 'r242', qty: 242, tags: ['a', 'b'] };
