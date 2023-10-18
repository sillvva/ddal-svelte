<script lang="ts">
	import Icon from "./Icon.svelte";

	export let href = "";
</script>

<a {href} class="mb-4 flex h-12 flex-1 items-center gap-4 text-secondary group-[.flex]:mb-0 sm:hidden">
	<Icon src="chevron-left" class="w-6" />
	<span>Back to <slot /></span>
</a>
