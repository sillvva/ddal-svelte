<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
</script>

<p class="mb-2 overflow-hidden text-ellipsis last:mb-0">{@render children?.()}</p>
