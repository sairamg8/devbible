export interface Row112 { id: string; qty: number; tags: string[] }
export function total112(rows: Row112[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample112: Row112 = { id: 'r112', qty: 112, tags: ['a', 'b'] };
