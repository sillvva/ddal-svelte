<script lang="ts" generics="T extends Route">
	import { resolveRoute, type Route, type RouteParamsProp } from "#lib/util.js";
	import type { Snippet } from "svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";

	let {
		href,
		params,
		children,
		...props
	}: Omit<HTMLAnchorAttributes, "href"> & {
		href: T;
		children: Snippet;
	} & RouteParamsProp<T> = $props();

	const resolved = $derived(resolveRoute(href, params));
</script>

<a href={resolved} {...props}>{@render children()}</a>
