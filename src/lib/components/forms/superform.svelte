<script lang="ts">
	import { dev } from "$app/environment";
	import { onMount, type Snippet } from "svelte";
	import { fromAction } from "svelte/attachments";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { Writable } from "svelte/store";
	import type { SuperForm } from "sveltekit-superforms";
	import SuperDebug from "sveltekit-superforms/SuperDebug.svelte";
	import FormMessage from "./form-message.svelte";

	type FormAttributes = Omit<HTMLFormAttributes, "hidden">;
	type T = $$Generic<Record<PropertyKey, unknown>>;

	interface Props extends Omit<FormAttributes, "action"> {
		superform: SuperForm<T, App.Superforms.Message> & { pending: Writable<boolean> };
		children?: Snippet;
	}

	let { superform, children, ...rest }: Props = $props();
	const { form, errors, message, enhance, capture, restore, submitting, tainted, pending } = superform;

	const isSubmitting = $derived($submitting || $pending);

	onMount(() => {
		superform.reset();
	});

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

	<form {...rest} method="post" {@attach fromAction(enhance)}>
		<fieldset class="grid grid-cols-12 gap-4" disabled={isSubmitting}>
			{@render children?.()}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebug data={{ $form, $errors, $message, isSubmitting, $tainted }} />
	{/if}
</div>
