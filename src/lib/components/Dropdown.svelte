<script lang="ts">
	import { clickoutside } from "@svelteuidev/composables";
	import { twMerge } from "tailwind-merge";

	let open = false;

	let className = "";
	export { className as class };

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
	<slot {close} />
</details>
