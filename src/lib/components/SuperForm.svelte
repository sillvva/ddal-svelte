<script lang="ts" context="module">
	type T = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends Record<string, unknown>">
	import type { HTMLFormAttributes } from "svelte/elements";
	import { type SuperForm } from "sveltekit-superforms";

	export let superForm: SuperForm<T, unknown>;
	export let method = "post";

	interface $$Props extends HTMLFormAttributes {
		superForm: SuperForm<T, unknown>;
		method?: "get" | "post";
	}

	const { form, submitting, enhance } = superForm;

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
		capture: () => $form,
		restore: (values: T) => ($form = values)
	};
</script>

<form bind:this={refForm} {...$$restProps} {method} use:enhance>
	<slot />
</form>
