<script lang="ts" generics="Input extends RemoteFormInput, Data extends Input | undefined = undefined">
	import { dev } from "$app/environment";
	import { configureForm, errorToast, successToast, type RemoteFormOptions } from "$lib/factories.svelte";
	import type { RemoteFormFields, RemoteFormInput } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { setContext, type Snippet } from "svelte";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";

	type Fields = RemoteFormFields<unknown>;
	type Configured = ReturnType<ReturnType<typeof configureForm<Input, Data>>>;

	interface Props extends RemoteFormOptions<Input, Data> {
		children?: Snippet<
			[
				{
					fields: Configured["form"]["fields"];
					initial: Configured["initial"];
					dirty: Configured["dirty"];
					touched: Configured["touched"];
					submitting: Configured["submitting"];
					reset: Configured["reset"];
				}
			]
		>;
	}

	let { children, ...rest }: Props = $props();

	let formEl: HTMLFormElement;

	const configured = setContext(
		"configured",
		configureForm(() => ({
			...rest,
			formEl,
			navBlockMessage: "You have unsaved changes. Are you sure you want to leave?",
			onresult: (ctx) => {
				if (ctx.success) {
					successToast(`${(form.fields as Fields).name?.value() || "Form"} saved successfully`);
				} else if (ctx.error) {
					errorToast(ctx.error);
				}
			}
		}))
	);

	const { form, attributes, issues, dirty, touched, submitting, pending, result, initial, reset } = $derived(configured());
</script>

<div class="flex flex-col gap-4">
	{#if issues && isTupleOfAtLeast(issues, 1)}
		<div class="alert alert-error shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			{issues[0].message}
		</div>
	{/if}

	<form {...attributes} bind:this={formEl}>
		<fieldset class="grid grid-cols-12 gap-4" disabled={pending}>
			{@render children?.({
				fields: form.fields,
				initial,
				dirty,
				touched,
				submitting,
				reset
			})}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebugRuned
			data={{
				dirty,
				touched,
				data: form.fields.value(),
				result,
				issues: (form.fields as Fields).allIssues()
			}}
		/>
	{/if}
</div>
