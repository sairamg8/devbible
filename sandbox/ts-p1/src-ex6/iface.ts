type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
interface IOrder { id: string; total: number }
type TOrder = { id: string; total: number };
declare const i: IOrder;
declare const t: TOrder;
const a: JsonValue = i;
const b: JsonValue = t;
