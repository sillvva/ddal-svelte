<script lang="ts" generics="Input extends RemoteFormInput | undefined = undefined">
	import { dev } from "$app/environment";
	import { navigating, page } from "$app/state";
	import { configureForm, errorToast, successToast, type GenericForm, type RemoteFormOptions } from "$lib/factories.svelte";
	import type { RemoteFormFields, RemoteFormInput } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { setContext, type Snippet } from "svelte";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";

	type Fields = RemoteFormFields<unknown>;

	interface Props extends Omit<RemoteFormOptions<Input>, "formEl"> {
		children?: Snippet<[GenericForm<Input>]>;
	}

	let { children, ...rest }: Props = $props();

	let formEl: HTMLFormElement | undefined = $state.raw();

	const configured = setContext(
		"configured-form",
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

	const { form, attributes, issues, dirty, touched, submitting, result } = $derived(configured());
</script>

<div class="flex flex-col gap-4">
	{#if issues && isTupleOfAtLeast(issues, 1)}
		<div class="alert alert-error shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			{issues[0].message}
		</div>
	{/if}

	<form {...attributes} bind:this={formEl}>
		<fieldset
			class="grid grid-cols-12 gap-4"
			disabled={submitting || (!!navigating.to && navigating.to.url.pathname !== page.url.pathname)}
		>
			{@render children?.(configured())}
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
