<script lang="ts">
	import { dev } from "$app/environment";
	import { type Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { Unsubscriber } from "svelte/store";
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

	const { form, enhance, submitting, errors, allErrors, message, capture, restore } = superform;
	const method = $derived(rest?.method || "post");

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
		<span class="iconify size-6 mdi--alert-circle"></span>
		{$errors._errors[0]}
	</div>
{/if}

<form {method} {...rest} use:enhance use:formstate>
	<div class="grid grid-cols-12 gap-4">
		{@render children?.()}
	</div>
</form>

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
