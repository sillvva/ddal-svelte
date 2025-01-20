<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { twMerge } from "tailwind-merge";

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class"> {
		children?: Snippet;
		class?: string | null;
	}

	let { class: className = "", children, ...rest }: Props = $props();
</script>

<div class={twMerge("grid grid-cols-12 gap-4", className)} {...rest}>
	{@render children?.()}
</div>
