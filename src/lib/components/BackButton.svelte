<script lang="ts">
	import Icon from "./Icon.svelte";

	export let href = "";
</script>

<a {href} class="mb-4 flex gap-4 text-secondary sm:hidden">
	<Icon src="chevron-left" class="w-6" />
	<span>Back to <slot /></span>
</a>
