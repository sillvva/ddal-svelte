<script lang="ts">
	import { type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;

	export let superform: SuperForm<T, any>;

	const { submitting } = superform;
</script>

<div class="col-span-12 text-center">
	<button
		type="submit"
		class="btn btn-primary w-full disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50 md:w-auto"
	>
		{#if $submitting}
			<span class="loading" />
		{/if}
		<slot />
	</button>
</div>
