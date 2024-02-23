<script lang="ts" context="module">
	type FormObj = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends FormObj">
	import FormMessage from "./FormMessage.svelte";

	import { dev } from "$app/environment";
	import { stringify } from "devalue";
	import { onMount } from "svelte";
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

	const { form, errors, allErrors, capture, restore, submitting, enhance, formId, message } = superform;
	const method = $$props.method || "post";

	let refForm: HTMLFormElement;
	let mounted = false;

	onMount(() => {
		refForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
			const name = el.getAttribute("name");
			if (name) {
				const label = refForm.querySelector(`label[for="${name}"]`);
				if (label) el.setAttribute("id", name);
			}

			if (el.hasAttribute("disabled")) (el as HTMLElement).dataset.disabled = "true";
		});
		mounted = true;

		superform.reset();
	});

	$: if (refForm && mounted) {
		refForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
			if ($submitting) {
				el.setAttribute("disabled", "disabled");
			} else if (!(el as HTMLElement).dataset.disabled) {
				el.removeAttribute("disabled");
			}
		});
	}

	$: if (refForm && mounted) {
		refForm.querySelectorAll(`[type="submit"]`).forEach((el) => {
			if ($allErrors.length) el.setAttribute("disabled", "disabled");
			else el.removeAttribute("disabled");
		});
	}

	export const snapshot = {
		capture,
		restore
	};
</script>

{#if showMessage}
	<FormMessage {message} />
{/if}

{#if basic}
	<form bind:this={refForm} {method} {...$$restProps}>
		<input type="hidden" name="__superform_id" value={$formId} />
		<input type="hidden" name="__superform_json" value={stringify($form)} />
		<div class="grid grid-cols-12 gap-4">
			<slot />
		</div>
	</form>
{:else}
	<form bind:this={refForm} {method} {...$$restProps} use:enhance>
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
