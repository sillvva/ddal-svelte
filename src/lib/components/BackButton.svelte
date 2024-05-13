<script lang="ts">
	export let href = "";
</script>

<a {href} class="mb-4 flex h-12 flex-1 items-center gap-4 text-secondary sm:hidden">
	<span class="mdi--chevron-left iconify size-6" />
	<span>Back to <slot /></span>
</a>
