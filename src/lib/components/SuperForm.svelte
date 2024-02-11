<script lang="ts" context="module">
	type T = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
	import { dev } from "$app/environment";

	import type { HTMLFormAttributes } from "svelte/elements";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";

	export let superForm: SuperForm<T, unknown>;
	export let method = "post";
	export const style = "margin-bottom: 1rem;";

	interface $$Props extends HTMLFormAttributes {
		superForm: SuperForm<T, unknown>;
		method?: "get" | "post";
		style?: string;
	}

	const { form, errors, capture, restore, submitting, enhance } = superForm;

	let refForm: HTMLFormElement;
	$: if (refForm) {
		refForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
			if ($submitting) {
				el.setAttribute("disabled", "disabled");
			} else {
				el.removeAttribute("disabled");
			}
		});
	}

	export const snapshot = {
		capture,
		restore
	};
</script>

<form bind:this={refForm} {...$$restProps} {method} {style} use:enhance>
	<slot />
</form>

<SuperDebug data={{ $form, $errors }} display={dev} />
