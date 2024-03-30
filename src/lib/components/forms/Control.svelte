<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { twMerge } from "tailwind-merge";

	interface $$Props extends HTMLAttributes<HTMLDivElement> {
		class?: string;
	}

	let className = "";
	export { className as class };
</script>

<div class={twMerge("form-control", className)}>
	<slot />
</div>
