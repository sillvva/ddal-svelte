<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { createEventDispatcher } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	const dispatch = createEventDispatcher<{
		input: string;
	}>();

	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T>;
		field: FormPathLeaves<T>;
		proxy: string;
	}

	export let superform: SuperForm<T>;
	export let field: FormPathLeaves<T>;
	export let proxy: string;

	const { errors, constraints } = formFieldProxy(superform, field);
</script>

<label for={field} class="label">
	<span class="label-text">
		<slot />
		{#if $$props.required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
<input
	type="datetime-local"
	bind:value={proxy}
	class="input input-bordered w-full focus:border-primary"
	aria-invalid={$errors ? "true" : undefined}
	{...$constraints}
	{...$$restProps}
/>
{#if $errors}
	<label for={field} class="label">
		<span class="label-text-alt text-error">{$errors}</span>
	</label>
{/if}
