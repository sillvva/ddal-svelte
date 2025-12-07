<script lang="ts">
	import type { RemoteFormFieldType, RemoteFormFieldValue } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";

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
		<span class="bg-error text-error-content rounded-lg px-2 py-1 text-pretty">{issues[0].message}</span>
	{:else if warning}
		<span class="bg-warning text-warning-content rounded-lg px-2 py-1 text-pretty">{warning}</span>
	{:else if description}
		<span class="text-pretty text-neutral-500">{description}</span>
	{/if}
{:else if type !== "hidden" && (issues?.length || warning || description)}
	<label for={name} class="fieldset-label">
		{#if issues && isTupleOfAtLeast(issues, 1)}
			<span class="bg-error text-error-content rounded-lg px-2 py-1 text-pretty">{issues[0].message}</span>
		{:else if warning}
			<span class="bg-warning text-warning-content rounded-lg px-2 py-1 text-pretty">{warning}</span>
		{:else if description}
			<span class="text-pretty text-neutral-500">{description}</span>
		{/if}
	</label>
{/if}
