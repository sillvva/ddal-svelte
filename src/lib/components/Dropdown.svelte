<script lang="ts">
	import { clickoutside } from "@svelteuidev/composables";
	import type { Snippet } from "svelte";
	import { twMerge } from "tailwind-merge";

	type Props = {
		class?: string;
		children: Snippet<[{ close: (node: HTMLLIElement) => void }]>;
	}

	let { class: className = "", children }: Props = $props();

	let open = $state(false);

	function close(node: HTMLLIElement) {
		node.addEventListener("click", () => {
			open = false;
		});
	}
</script>

<details
	use:clickoutside={{
		enabled: open,
		callback: () => {
			open = false;
		}
	}}
	class={twMerge("dropdown", className)}
	bind:open
>
	{@render children({ close })}
</details>
