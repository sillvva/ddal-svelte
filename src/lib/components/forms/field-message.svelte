<script lang="ts">
	import type { RemoteFormFieldType, RemoteFormFieldValue } from "$app/server";
	import { isTupleOfAtLeast } from "@sillvva/utils";

	interface Props {
		name?: string;
		type: RemoteFormFieldType<RemoteFormFieldValue>;
		description?: string;
		warning?: string;
		issues?: {
			message: string;
		}[];
	}

	let { name, type = "text", description, warning, issues }: Props = $props();
</script>

{#if type === "checkbox"}
	{#if issues && isTupleOfAtLeast(issues, 1)}
		<span class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{issues[0].message}</span>
	{:else if warning}
		<span class="rounded-lg bg-warning px-2 py-1 text-pretty text-warning-content">{warning}</span>
	{:else if description}
		<span class="text-pretty text-neutral-500">{description}</span>
	{/if}
{:else if type !== "hidden"}
	<label for={name} class="fieldset-label">
		{#if issues && isTupleOfAtLeast(issues, 1)}
			<span class="rounded-lg bg-error px-2 py-1 text-pretty text-error-content">{issues[0].message}</span>
		{:else if warning}
			<span class="rounded-lg bg-warning px-2 py-1 text-pretty text-warning-content">{warning}</span>
		{:else if description}
			<span class="text-pretty text-neutral-500">{description}</span>
		{:else}
			<span></span>
		{/if}
	</label>
{/if}
