export interface Row67 { id: string; qty: number; tags: string[] }
export function total67(rows: Row67[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample67: Row67 = { id: 'r67', qty: 67, tags: ['a', 'b'] };
