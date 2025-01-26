<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
</script>

<table class="mb-4 table w-full overflow-hidden rounded-lg">{@render children?.()}</table>
