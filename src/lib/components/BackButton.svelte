<script lang="ts">
	export let href = "";
</script>

<a {href} class="mb-4 flex h-12 flex-1 items-center gap-4 text-secondary sm:hidden print:hidden">
	<span class="iconify size-6 mdi--chevron-left" />
	<span>Back to <slot /></span>
</a>
