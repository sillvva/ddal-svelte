<script lang="ts">
	import { twMerge } from "tailwind-merge";

	interface Props {
		fixed?: boolean;
	}

	let { fixed = false }: Props = $props();
</script>

<footer
	class={twMerge(
		"footer footer-center border-base-300 text-base-content  z-16 border-t p-4 max-sm:py-2 max-sm:text-xs print:hidden",
		fixed ? "sticky right-0 bottom-0 left-0" : "relative"
	)}
>
	<div>
		<p>
			The name
			<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary"
				>Adventurers League</a
			>
			is property of Hasbro and
			<a href="https://dnd.wizards.com/" target="_blank" rel="noreferrer noopener" class="text-secondary">Wizards of the Coast</a
			>. This website is affiliated with neither.
		</p>
	</div>
</footer>
