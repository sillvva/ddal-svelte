<script
	lang="ts"
	generics="Schema extends StandardSchemaV1<RemoteFormInput, unknown>, Form extends RemoteForm<StandardSchemaV1.InferInput<Schema>, unknown>"
>
	import { dev } from "$app/environment";
	import { beforeNavigate } from "$app/navigation";
	import { successToast, unknownErrorToast } from "$lib/factories.svelte";
	import type { Awaitable } from "$lib/types";
	import { deepEqual } from "@sillvva/utils";
	import type { StandardSchemaV1 } from "@standard-schema/spec";
	import type { RemoteForm, RemoteFormInput, RemoteFormIssue } from "@sveltejs/kit";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import { onMount, tick, type Snippet } from "svelte";
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
		onresult?: (ctx: { readonly success: boolean; readonly result: Form["result"]; readonly issues?: RemoteFormIssue[] }) => void;
		children?: Snippet<[{ fields: Form["fields"] }]>;
	}

	let { schema, form: remoteForm, children, data, initialErrors = false, onsubmit, onresult, ...rest }: Props = $props();

	let formEl = $state<HTMLFormElement | null>(null);
	let hadIssues = $derived(false);

	const form = remoteForm.for((data.id ?? v7()) as FormId).preflight(schema);
	form.fields.set(data);

	const result = $derived(form.result);
	const issues = $derived(form.fields.issues());

	const initial = $state.snapshot(data);
	let tainted = $derived(!deepEqual(initial, form.fields.value()));

	async function validate() {
		await form.validate({ includeUntouched: true, preflightOnly: true });
		hadIssues ||= !!form.fields.allIssues()?.length;
	}

	async function focusInvalid() {
		await tick();
		hadIssues ||= !!form.fields.allIssues()?.length;

		const invalid = formEl?.querySelector(":is(input, select, textarea):not(.hidden, [type=hidden], :disabled)[aria-invalid]") as
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
		if ((tainted || issues) && !confirm("You have unsaved changes. Are you sure you want to leave?")) {
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
			const bf = !onsubmit || (await onsubmit({ tainted, form: formEl, data }));
			if (!bf) return;

			let wasTainted = tainted;
			try {
				tainted = false;
				await submit();

				const issues = form.fields.allIssues();
				const success = !issues?.length;

				onresult?.({ success, result: form.result, issues });

				if (success) {
					successToast(`${form.fields.name?.value() || "Form"} saved successfully`);
				} else {
					tainted = wasTainted;
					await focusInvalid();
				}
			} catch (err) {
				unknownErrorToast(err || "Oh no! Something went wrong");
				tainted = wasTainted;
			}
		})}
		{...rest}
		bind:this={formEl}
		onsubmit={focusInvalid}
		oninput={(ev) => {
			if (hadIssues) validate();
			rest.oninput?.(ev);
		}}
	>
		<fieldset class="grid grid-cols-12 gap-4" disabled={!!$effect.pending()}>
			{@render children?.({ fields: form.fields })}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebugRuned
			data={{
				action: form.action,
				tainted,
				data: form.fields.value(),
				result,
				hadIssues,
				issues: form.fields.allIssues()
			}}
		/>
	{/if}
</div>
