<script>
	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { children } = $props();
</script>

<p class="mb-2 last:mb-0">{@render children?.()}</p>

<style>
	p:has(:global(.md-image) + :global(.md-image)) {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		:global(.md-image) {
			flex: 0 1 calc((100% - 2rem) / 3);
		}
	}
	p:has(:global(.md-image)):not(:has(:global(.md-image) + :global(.md-image))) {
		:global(.md-image) {
			aspect-ratio: 16 / 9;
		}
	}
</style>
