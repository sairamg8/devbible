interface IParcel { id: string; weightKg: number }
type TParcel = { id: string; weightKg: number };
declare function shipI(p: IParcel): void;
declare function shipT(p: TParcel): void;
shipI({ id: 'a' });
shipT({ id: 'a' });
