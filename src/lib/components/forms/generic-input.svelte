<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLInputAttributes } from "svelte/elements";

	interface Props {
		required?: HTMLInputAttributes["required"];
		label: string;
		labelFor?: string;
		fieldErrors?: string[];
		children?: Snippet;
	}

	let { required = false, label, labelFor = "", fieldErrors = [], children }: Props = $props();
</script>

<label for={labelFor} class="fieldset-legend">
	<span>
		{label}
		{#if required}
			<span class="text-error">*</span>
		{/if}
	</span>
</label>
{@render children?.()}
{#if fieldErrors?.length}
	<label for={labelFor} class="fieldset-label">
		<span class="text-error">{fieldErrors[0]}</span>
	</label>
{/if}
