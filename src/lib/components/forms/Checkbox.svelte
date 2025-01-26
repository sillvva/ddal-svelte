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

<label class="label border-base-content/20 flex cursor-pointer rounded-lg border p-4 text-sm">
	<span class="text-base-content flex-1">
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
	<input type="checkbox" bind:checked={$value} {required} class="checkbox-primary checkbox" />
</label>
