<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { type SuperForm } from "sveltekit-superforms";

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
