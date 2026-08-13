export interface Row25 { id: string; qty: number; tags: string[] }
export function total25(rows: Row25[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample25: Row25 = { id: 'r25', qty: 25, tags: ['a', 'b'] };
