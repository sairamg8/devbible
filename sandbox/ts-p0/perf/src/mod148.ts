export interface Row148 { id: string; qty: number; tags: string[] }
export function total148(rows: Row148[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample148: Row148 = { id: 'r148', qty: 148, tags: ['a', 'b'] };
