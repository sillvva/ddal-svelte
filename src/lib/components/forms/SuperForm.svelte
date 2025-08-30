<script lang="ts">
	import { dev } from "$app/environment";
	import type { Pathname } from "$app/types";
	import type { EffectResult } from "$lib/server/effect/runtime";
	import { onMount, type Snippet } from "svelte";
	import { fromAction } from "svelte/attachments";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { Writable } from "svelte/store";
	import type { SuperForm, SuperValidated } from "sveltekit-superforms";
	import SuperDebug from "sveltekit-superforms/SuperDebug.svelte";
	import FormMessage from "./FormMessage.svelte";

	type FormAttributes = Omit<HTMLFormAttributes, "hidden">;
	type T = $$Generic<Record<PropertyKey, unknown>>;
	type TForm = $$Generic<SuperValidated<T, App.Superforms.Message>>;
	type TRemoteCommand = $$Generic<((data: T) => Promise<EffectResult<TForm | Pathname>>) & { pending: number }>;

	interface Props extends Omit<FormAttributes, "action"> {
		superform: SuperForm<T, App.Superforms.Message> & { pending: Writable<boolean> };
		children?: Snippet;
	}

	let { superform, children, ...rest }: Props = $props();
	const { form, errors, message, enhance, capture, restore, submitting, tainted } = superform;
	const { pending } = superform;

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
