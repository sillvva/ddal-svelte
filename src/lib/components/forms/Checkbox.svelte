<script lang="ts">
	import type { HTMLInputAttributes } from "svelte/elements";
	import { formFieldProxy, type FormFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	type T = $$Generic<Record<PropertyKey, unknown>>;
	interface Props {
		superform: SuperForm<T>;
		field: FormPathLeaves<T, boolean>;
		required?: HTMLInputAttributes["required"];
		label: string;
	}

	let { superform, field, required = false, label }: Props = $props();

	const { value } = formFieldProxy(superform, field) satisfies FormFieldProxy<boolean>;
</script>

<label class="label cursor-pointer rounded-lg border border-base-300 p-4">
	<span class="label-text">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
	<input type="checkbox" bind:checked={$value} {required} class="checkbox-primary checkbox" />
</label>
