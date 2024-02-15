<script lang="ts" context="module">
	type FormObj = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends FormObj">
	import { dev } from "$app/environment";
	import { stringify } from "devalue";
	import { onMount } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";

	export let superForm: SuperForm<T, any>;
	export let basic = false;

	type $$Props = HTMLFormAttributes & {
		superForm: SuperForm<T, any>;
		basic?: boolean;
	};

	const { form, errors, allErrors, capture, restore, submitting, enhance, formId } = superForm;
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

{#if basic}
	<form bind:this={refForm} {method} {...$$restProps}>
		<input type="hidden" name="__superform_id" value={$formId} />
		<input type="hidden" name="__superform_json" value={stringify($form)} />
		<slot />
	</form>
{:else}
	<form bind:this={refForm} {method} {...$$restProps} use:enhance>
		<slot />
	</form>
{/if}

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
