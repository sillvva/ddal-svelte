<script lang="ts">
	import { dev } from "$app/environment";
	import { type Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";
	import FormMessage from "./FormMessage.svelte";

	type FormAttributes = Omit<HTMLFormAttributes, "hidden">;
	type T = $$Generic<Record<PropertyKey, unknown>>;
	interface Props extends FormAttributes {
		superform: SuperForm<T, App.Superforms.Message>;
		showMessage?: boolean;
		children?: Snippet;
	}

	let { superform, showMessage = $bindable(false), children, ...rest }: Props = $props();

	const { form, enhance, submitting, errors, message, capture, restore } = superform;
	const method = $derived(rest?.method || "post");

	$effect(() => {
		superform.reset();
	});

	$effect(() => {
		showMessage = !superform.options.resetForm;
	});

	export const snapshot = {
		capture,
		restore
	};
</script>

{#if showMessage}
	<FormMessage {message} />
{/if}

{#if $errors._errors?.[0]}
	<div class="alert alert-error mb-4 shadow-lg">
		<span class="iconify mdi--alert-circle size-6"></span>
		{$errors._errors[0]}
	</div>
{/if}

<form {method} {...rest} {@attach enhance}>
	<fieldset class="grid grid-cols-12 gap-4" disabled={$submitting}>
		{@render children?.()}
	</fieldset>
</form>

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
