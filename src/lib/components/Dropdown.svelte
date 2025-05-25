<script lang="ts">
	import { clickoutside } from "@svelteuidev/composables";
	import type { Snippet } from "svelte";
	import { fromAction } from "svelte/attachments";
	import type { HTMLAttributes } from "svelte/elements";
	import { twMerge } from "tailwind-merge";

	interface Props extends Omit<HTMLAttributes<HTMLDetailsElement>, "children" | "class"> {
		children?: Snippet<[{ close: (node: HTMLLIElement) => () => void }]>;
		class?: string | null;
	}

	let { class: className = "", children }: Props = $props();

	let open = $state(false);

	function close(node: HTMLLIElement) {
		const abortController = new AbortController();
		node.addEventListener(
			"click",
			() => {
				open = false;
			},
			{ signal: abortController.signal }
		);
		return () => abortController.abort();
	}
</script>

<details
	bind:open
	class={twMerge("dropdown", className)}
	{@attach fromAction(clickoutside, () => ({
		enabled: open,
		callback: () => {
			open = false;
		}
	}))}
>
	<summary class="list-none">
		<button tabindex="0" class="btn btn-sm" aria-label="Menu" onclick={() => (open = !open)}>
			<span class="iconify mdi--dots-horizontal size-6"></span>
		</button>
	</summary>
	{@render children?.({ close })}
</details>
