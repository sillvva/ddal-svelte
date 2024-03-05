<script lang="ts">
	export let href = "";
</script>

<a {href} class="mb-4 flex h-12 flex-1 items-center gap-4 text-secondary group-[.flex]:mb-0 sm:hidden">
	<span class="iconify mdi-chevron-left size-6" />
	<span>Back to <slot /></span>
</a>
