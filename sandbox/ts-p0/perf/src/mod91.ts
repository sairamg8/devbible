export interface Row91 { id: string; qty: number; tags: string[] }
export function total91(rows: Row91[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample91: Row91 = { id: 'r91', qty: 91, tags: ['a', 'b'] };
