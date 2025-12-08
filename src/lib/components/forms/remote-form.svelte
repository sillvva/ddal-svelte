<script
	lang="ts"
	generics="Schema extends StandardSchemaV1<RemoteFormInput, unknown>, Form extends RemoteForm<StandardSchemaV1.InferInput<Schema>, unknown>"
>
	import { dev } from "$app/environment";
	import { beforeNavigate } from "$app/navigation";
	import { page } from "$app/state";
	import { initForm, successToast, unknownErrorToast } from "$lib/factories.svelte";
	import { debounce, deepEqual } from "@sillvva/utils";
	import type { StandardSchemaV1 } from "@standard-schema/spec";
	import type { RemoteForm, RemoteFormFields, RemoteFormInput, RemoteFormIssue } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { onMount, tick, untrack, type Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";
	import { v7 } from "uuid";

	type Input = StandardSchemaV1.InferInput<Schema>;
	type FormId = Input extends { id: infer Id } ? (Id extends string | number ? Id : string | number) : string | number;
	interface Props extends Omit<HTMLFormAttributes, "children" | "action" | "method" | "onsubmit"> {
		schema: Schema;
		form: Form;
		data: Input;
		initialErrors?: boolean;
		onsubmit?: <T>(ctx: { readonly tainted: boolean; readonly form: HTMLFormElement; readonly data: Input }) => Awaitable<T>;
		onresult?: (ctx: {
			readonly success: boolean;
			readonly result?: Form["result"];
			readonly issues?: RemoteFormIssue[];
			readonly error?: unknown;
		}) => Awaitable<void>;
		onissues?: (ctx: { readonly issues: RemoteFormIssue[] }) => Awaitable<void>;
		children?: Snippet<[{ fields: Form["fields"]; initial: Input; dirty: boolean; touched: boolean }]>;
	}

	let {
		schema,
		form: remoteForm,
		children,
		data,
		initialErrors = !!data.id,
		onsubmit,
		onresult,
		onissues,
		...rest
	}: Props = $props();

	let formEl: HTMLFormElement;

	const form = remoteForm.for((data.id ?? v7()) as FormId).preflight(schema);
	initForm(form, () => data);

	// svelte-ignore state_referenced_locally
	let initial = $state.raw($state.snapshot(data));
	let dirty = $derived(!deepEqual(initial, $state.snapshot(form.fields.value())));
	let touched = $state.raw(false);
	$effect(() => {
		void page.url;
		initial = untrack(() => $state.snapshot(data));
	});

	const result = $derived(form.result);
	const issues = $derived(form.fields.issues());
	let lastIssues = $state.raw<RemoteFormIssue[] | undefined>((form.fields as RemoteFormFields<unknown>).allIssues());

	const debouncedValidate = debounce(validate, 300);

	async function validate() {
		await form.validate({ includeUntouched: true, preflightOnly: true });
		const issues = (form.fields as RemoteFormFields<unknown>).allIssues();
		if (issues && onissues && !deepEqual(lastIssues, issues)) onissues({ issues });
		if (issues?.length) lastIssues = issues;
	}

	async function focusInvalid() {
		await tick();

		const issues = (form.fields as RemoteFormFields<unknown>).allIssues();
		if (issues?.length) lastIssues = issues;
		else return;

		const invalid = formEl.querySelector(":is(input, select, textarea):not(.hidden, [type=hidden], :disabled)[aria-invalid]") as
			| HTMLInputElement
			| HTMLSelectElement
			| HTMLTextAreaElement
			| null;
		invalid?.focus();
	}

	onMount(() => {
		if (initialErrors) validate();
	});

	beforeNavigate((ev) => {
		if ((dirty || issues) && !confirm("You have unsaved changes. Are you sure you want to leave?")) {
			return ev.cancel();
		}
	});
</script>

<div class="flex flex-col gap-4">
	{#if issues && isTupleOfAtLeast(issues, 1)}
		<div class="alert alert-error shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			{issues[0].message}
		</div>
	{/if}

	<form
		{...form.enhance(async ({ submit, form: formEl, data }) => {
			const bf = !onsubmit || (await onsubmit({ tainted: dirty, form: formEl, data }));
			if (!bf) return;

			let wasDirty = dirty;
			try {
				dirty = false;
				await submit();

				const issues = (form.fields as RemoteFormFields<unknown>).allIssues();
				const success = !issues?.length;

				onresult?.({ success, result: form.result, issues });

				if (success) {
					successToast(`${(form.fields as RemoteFormFields<unknown>).name?.value() || "Form"} saved successfully`);
				} else {
					dirty = wasDirty;
					await focusInvalid();
					onissues?.({ issues });
				}
			} catch (error) {
				unknownErrorToast(error || "Oh no! Something went wrong");
				onresult?.({ success: false, error });
				dirty = wasDirty;
			}
		})}
		{...rest}
		bind:this={formEl}
		onsubmit={focusInvalid}
		oninput={(ev) => {
			if (!!lastIssues) debouncedValidate.call();
			rest.oninput?.(ev);
		}}
	>
		<fieldset class="grid grid-cols-12 gap-4" disabled={!!$effect.pending()} onfocusin={() => (touched = true)}>
			{@render children?.({ fields: form.fields, initial, dirty, touched })}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebugRuned
			data={{
				dirty,
				touched,
				data: form.fields.value(),
				result,
				issues: (form.fields as RemoteFormFields<unknown>).allIssues()
			}}
		/>
	{/if}
</div>
