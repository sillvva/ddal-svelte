<script lang="ts" generics="T extends PathnameWithSearchOrHash | RouteIdWithSearchOrHash">
	import { resolve } from "$app/paths";
	import type { PathnameWithSearchOrHash, RouteIdWithSearchOrHash } from "$app/types";
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	type Args = Parameters<typeof resolve<T>>;
	type Params = Args extends [route: unknown, params: infer P] ? P : undefined;

	let {
		href,
		params,
		children,
		...props
	}: Omit<HTMLAnchorAttributes, "href"> & {
		href: T;
		params?: Params;
		children: Snippet;
	} = $props();

	const resolved = $derived(resolve(...([href, params].filter((arg) => arg !== undefined) as Args)));
</script>

<a href={resolved} {...props}>{@render children()}</a>
