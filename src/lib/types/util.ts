export type DatesToStrings<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
		? string | null
		: T[K] extends Date | undefined
		? string | undefined
		: T[K] extends Date | null | undefined
		? string | null | undefined
		: T[K] extends object
		? DatesToStrings<T[K]>
		: T[K];
};
