<script lang="ts" context="module">
	type FormObj = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends FormObj">
	import type { Unsubscriber } from "svelte/store";

	import { onMount } from "svelte";
	import FormMessage from "./FormMessage.svelte";

	import { dev } from "$app/environment";
	import { stringify } from "devalue";
	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";

	type $$Props = HTMLFormAttributes & {
		superform: SuperForm<T, any>;
		basic?: boolean;
		showMessage?: boolean;
	};

	export let superform: SuperForm<T, any>;
	export let basic = false;
	export let showMessage = false;
	$: showMessage = !superform.options.resetForm;

	const { form, errors, allErrors, capture, restore, submitting, enhance, formId, message, tainted } = superform;
	const method = $$props.method || "post";

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

{#if basic}
	<form {method} {...$$restProps} use:formstate>
		<input type="hidden" name="__superform_id" value={$formId} />
		<input type="hidden" name="__superform_json" value={stringify($form)} />
		<div class="grid grid-cols-12 gap-4">
			<slot />
		</div>
	</form>
{:else}
	<form {method} {...$$restProps} use:enhance use:formstate>
		<div class="grid grid-cols-12 gap-4">
			<slot />
		</div>
	</form>
{/if}

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
