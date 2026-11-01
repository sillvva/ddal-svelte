<script lang="ts">
	interface Props {
		fixed?: boolean;
	}

	let { fixed = false }: Props = $props();
</script>

<footer
	class={[
		"z-16 footer footer-center border-t border-base-300 p-4 text-base-content max-sm:py-2 max-sm:text-xs print:hidden",
		fixed ? "sticky right-0 bottom-0 left-0" : "relative"
	]}
>
	<div>
		<p>
			The name
			<a
				href="https://dnd.wizards.com/adventurers-league"
				target="_blank"
				rel="noreferrer noopener"
				class="text-secondary-content">Adventurers League</a
			>
			is property of Hasbro and
			<a href="https://dnd.wizards.com/" target="_blank" rel="noreferrer noopener" class="text-secondary-content"
				>Wizards of the Coast</a
			>. This website is affiliated with neither.
		</p>
	</div>
</footer>
