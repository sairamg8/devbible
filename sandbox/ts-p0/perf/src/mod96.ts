export interface Row96 { id: string; qty: number; tags: string[] }
export function total96(rows: Row96[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample96: Row96 = { id: 'r96', qty: 96, tags: ['a', 'b'] };
