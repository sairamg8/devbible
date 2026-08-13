export interface Row103 { id: string; qty: number; tags: string[] }
export function total103(rows: Row103[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample103: Row103 = { id: 'r103', qty: 103, tags: ['a', 'b'] };
