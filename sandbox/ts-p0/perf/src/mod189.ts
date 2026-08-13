export interface Row189 { id: string; qty: number; tags: string[] }
export function total189(rows: Row189[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample189: Row189 = { id: 'r189', qty: 189, tags: ['a', 'b'] };
