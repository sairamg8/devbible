export interface Row216 { id: string; qty: number; tags: string[] }
export function total216(rows: Row216[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample216: Row216 = { id: 'r216', qty: 216, tags: ['a', 'b'] };
