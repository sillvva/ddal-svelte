<script
	lang="ts"
	generics="Schema extends StandardSchemaV1<RemoteFormInput, unknown>, Form extends RemoteForm<StandardSchemaV1.InferInput<Schema>, unknown>"
>
	import { dev } from "$app/environment";
	import { beforeNavigate } from "$app/navigation";
	import { successToast, unknownErrorToast } from "$lib/factories.svelte";
	import { debounce, deepEqual } from "@sillvva/utils";
	import type { StandardSchemaV1 } from "@standard-schema/spec";
	import type { RemoteForm, RemoteFormFields, RemoteFormInput, RemoteFormIssue } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { tick, untrack, type Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";
	import { v7 } from "uuid";

	type Input = StandardSchemaV1.InferInput<Schema>;
	type FormId = Input extends { id: infer Id } ? (Id extends string | number ? Id : string | number) : string | number;
	type Fields = RemoteFormFields<unknown>;
	interface Props extends Omit<HTMLFormAttributes, "children" | "action" | "method" | "onsubmit"> {
		schema: Schema;
		form: Form;
		data: Input;
		key?: FormId;
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
		key = (data.id ?? v7()) as FormId,
		initialErrors = !!data.id,
		onsubmit,
		onresult,
		onissues,
		...rest
	}: Props = $props();

	let formEl: HTMLFormElement;

	const form = $derived(remoteForm.for(key).preflight(schema));

	// svelte-ignore state_referenced_locally
	form.fields.set(data as any);
	// svelte-ignore state_referenced_locally
	let initial = $state.raw($state.snapshot(data));
	let touched = $state.raw(false);
	let dirty = $derived(!deepEqual(initial, $state.snapshot(form.fields.value())));

	const result = $derived(form.result);
	const issues = $derived(form.fields.issues());
	const allIssues = $derived((form.fields as Fields).allIssues());
	let lastIssues = $state.raw<RemoteFormIssue[] | undefined>();

	let hydrated1 = false;
	$effect(() => {
		// When the form, key, or schema changes
		void form;
		untrack(() => {
			// During hydration, do the following:
			if (!hydrated1) {
				// Validate if there are initial errors
				if (initialErrors) validate();
				return void (hydrated1 = true);
			}
			// After hydration, on change, do the following:
			form.fields.set(data as any);
			initial = $state.snapshot(data);
			if (initialErrors) validate(true);
		});
	});

	let hydrated2 = false;
	$effect(() => {
		void data;
		if (!hydrated2) return void (hydrated2 = true);
		form.fields.set(data as any);
	});

	const debouncedValidate = debounce(validate, 300);

	async function validate(reset = false) {
		await form.validate({ includeUntouched: true, preflightOnly: true });
		if (allIssues && onissues && !deepEqual(lastIssues, allIssues)) onissues({ issues: allIssues });
		if (reset) lastIssues = undefined;
		if (allIssues) lastIssues = allIssues;
	}

	async function focusInvalid() {
		await tick();

		if (allIssues) lastIssues = allIssues;
		else return;

		const invalid = formEl.querySelector(":is(input, select, textarea):not(.hidden, [type=hidden], :disabled)[aria-invalid]") as
			| HTMLInputElement
			| HTMLSelectElement
			| HTMLTextAreaElement
			| null;
		invalid?.focus();
	}

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

				const success = !allIssues;
				onresult?.({ success, result: form.result, issues: allIssues });

				if (success) {
					successToast(`${(form.fields as Fields).name?.value() || "Form"} saved successfully`);
				} else {
					dirty = wasDirty;
					await focusInvalid();
					onissues?.({ issues: allIssues });
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
