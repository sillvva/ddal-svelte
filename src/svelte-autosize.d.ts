declare module "svelte-autosize" {
	import type { Action } from "svelte/action";

	const autosize: Action<HTMLElement> & {
		update: (element: HTMLElement) => void;
		destroy: (element: HTMLElement) => void;
	};
	export default autosize;
}
