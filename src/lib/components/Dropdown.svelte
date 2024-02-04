<script lang="ts">
	import { clickoutside } from "@svelteuidev/composables";
	import { onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	let open = false;

	let className = "";
	export { className as class };

	let details: HTMLDetailsElement;

	onMount(() => {
		if (details) {
			const listItems = details.querySelectorAll("ul li");
			if (listItems.length) {
				listItems.forEach((item) => {
					item.addEventListener("click", () => {
						open = false;
					});
				});
			}
		}
	});
</script>

<details
	use:clickoutside={{
		enabled: true,
		callback: () => {
			open = false;
		}
	}}
	class={twMerge("dropdown", className)}
	bind:this={details}
	bind:open
>
	<slot />
</details>
