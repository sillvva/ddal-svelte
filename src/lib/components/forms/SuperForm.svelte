<script lang="ts">
	import { dev } from "$app/environment";
	import { goto } from "$app/navigation";
	import { onMount, type Snippet } from "svelte";
	import { fromAction } from "svelte/attachments";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { SuperForm, SuperValidated } from "sveltekit-superforms";
	import SuperDebug from "sveltekit-superforms/SuperDebug.svelte";
	import FormMessage from "./FormMessage.svelte";

	type FormAttributes = Omit<HTMLFormAttributes, "hidden">;
	type T = $$Generic<Record<PropertyKey, unknown>>;
	type TForm = $$Generic<SuperValidated<T, App.Superforms.Message>>;
	type TRemoteCommand = $$Generic<(data: T) => Promise<TForm | `/${string}`>>;

	interface Props extends FormAttributes {
		superform: SuperForm<T, App.Superforms.Message>;
		remote?: TRemoteCommand;
		children?: Snippet;
	}

	let { superform, children, remote, ...rest }: Props = $props();

	const { form, errors, message, capture, restore, validateForm, enhance, submit, submitting } = superform;

	const action = $derived(remote ? undefined : rest?.action);
	const method = $derived(remote ? "post" : rest?.method || "post");

	let isSubmitting = $state(false);

	onMount(() => {
		superform.reset();
	});

	$effect(() => {
		if (!remote) isSubmitting = $submitting;
	});

	function unknownErrorMessage(error: unknown) {
		console.log(error);
		if (typeof error === "string") $errors = { _errors: [error] };
		else if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string")
			$errors = { _errors: [error.message] };
		else $errors = { _errors: ["An unknown error occurred"] };
	}

	export const snapshot = {
		capture,
		restore
	};
</script>

<div class="flex flex-col gap-4">
	<FormMessage {message} />

	{#if $errors._errors?.[0]}
		<div class="alert alert-error shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			{$errors._errors[0]}
		</div>
	{/if}

	<form
		{...rest}
		{method}
		{action}
		{@attach fromAction(enhance)}
		onsubmit={async (e) => {
			e.preventDefault();
			if (!remote) return submit(e);

			const r = await validateForm({ update: true });
			if (!r.valid) return;

			isSubmitting = true;

			try {
				const result = await remote($form);
				if (typeof result === "string") return goto(result);

				$form = result.data;
				$errors = result.errors;
				$message = result.message;
			} catch (err) {
				unknownErrorMessage(err);
			}

			isSubmitting = false;
		}}
	>
		<fieldset class="grid grid-cols-12 gap-4" disabled={isSubmitting}>
			{@render children?.()}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebug data={{ $form, $errors, $message, isSubmitting }} />
	{/if}
</div>
