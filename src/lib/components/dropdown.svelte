<script lang="ts">
	import { clickoutside } from "@svelteuidev/composables";
	import type { Snippet } from "svelte";
	import { fromAction } from "svelte/attachments";
	import type { ClassValue, HTMLAttributes } from "svelte/elements";

	interface Props extends Omit<HTMLAttributes<HTMLDetailsElement>, "children" | "class"> {
		children?: Snippet;
		class?: ClassValue;
	}

	let { class: className = "", children }: Props = $props();

	let open = $state(false);

	function menuClose(node: HTMLDetailsElement) {
		const abortController = new AbortController();
		node.querySelectorAll("li").forEach((li) => {
			li.addEventListener(
				"click",
				() => {
					open = false;
				},
				{ signal: abortController.signal }
			);
		});
		return () => abortController.abort();
	}
</script>

<details
	bind:open
	class={["dropdown", className]}
	{@attach menuClose}
	{@attach fromAction(clickoutside, () => ({
		enabled: open,
		callback: () => {
			open = false;
		}
	}))}
>
	<summary class="list-none">
		<button tabindex="0" class="btn btn-sm touch-hitbox h-9" aria-label="Menu" onclick={() => (open = !open)}>
			<span class="iconify mdi--dots-horizontal size-6"></span>
		</button>
	</summary>
	{@render children?.()}
</details>
