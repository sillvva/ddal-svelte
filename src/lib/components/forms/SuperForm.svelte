<script lang="ts" context="module">
	type FormObj = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends FormObj">
	import { dev } from "$app/environment";
	import { onMount } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { Unsubscriber } from "svelte/store";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";
	import FormMessage from "./FormMessage.svelte";

	interface $$Props extends HTMLFormAttributes {
		superform: SuperForm<T, any>;
		showMessage?: boolean;
	}

	$: rest = $$restProps as HTMLFormAttributes | undefined;

	export let superform: SuperForm<T, any>;
	export let showMessage = false;

	$: showMessage = !superform.options.resetForm;

	const { form, enhance, submitting, errors, allErrors, message, capture, restore } = superform;
	const method = rest?.method || "post";

	function formstate(refForm: HTMLFormElement) {
		const unsubscribers: Unsubscriber[] = [];

		refForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
			const name = el.getAttribute("name");
			if (name) {
				const label = refForm.querySelector(`label[for="${name}"]`);
				if (label) el.setAttribute("id", name);
			}

			const disabled = el.hasAttribute("disabled");
			unsubscribers.push(
				submitting.subscribe((submitting) => {
					if (submitting) el.setAttribute("disabled", "disabled");
					else if (!disabled && showMessage && $message) el.removeAttribute("disabled");
				})
			);
		});

		refForm.querySelectorAll(`[type="submit"]`).forEach((el) => {
			unsubscribers.push(
				allErrors.subscribe((errors) => {
					if (errors.length) el.setAttribute("disabled", "disabled");
					else el.removeAttribute("disabled");
				})
			);
		});

		return {
			destroy() {
				unsubscribers.forEach((unsub) => unsub());
			}
		};
	}

	onMount(() => {
		superform.reset();
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
		<span class="iconify size-6 mdi-alert-circle" />
		{$errors._errors[0]}
	</div>
{/if}

<form {method} {...rest} use:enhance use:formstate>
	<div class="grid grid-cols-12 gap-4">
		<slot />
	</div>
</form>

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
