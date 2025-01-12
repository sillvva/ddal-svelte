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

<div class={twMerge("form-control", className)} {...rest}>
	{@render children?.()}
</div>
