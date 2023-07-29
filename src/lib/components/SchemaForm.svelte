<script lang="ts">
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";
	import type { ObjectSchema, Output } from "valibot";
	import { ValiError, flatten } from "valibot";

	const dispatch = createEventDispatcher<{
		"before-submit": null;
		"after-submit": ActionResult;
		errors: Record<string, string> | null;
		"check-errors": null;
	}>();

	let elForm: HTMLFormElement;

	export let form: (object & { error: string | null | undefined }) | null;
	export let schema: ObjectSchema<any, any>;
	export let data: object;
	export let action: string;
	export let stringify = "";
	export let resetOnSave = false;

	export let saving = false;
	$: {
		if (form?.error && saving) saving = false;
		else if (form && saving) changes = new Set<string>();
	}

	export let changes = new Set<string>();
	let savedChanges = new Set<string>();
	export function addChanges(field: string) {
		changes.add(field);
	}

	export let errors: Record<string, string> = {};
	$: {
		if (changes.size) {
			errors = {};
			try {
				schema.parse(data);
			} catch (error) {
				changes.forEach((c) => {
					if (error instanceof ValiError) {
						const flatErrors = flatten(error);
						for (const path in flatErrors.nested) {
							for (const err in flatErrors.nested[path]) {
								if (path === c && !errors[c]) errors[c] = err;
							}
						}
					}
				});
			}

			dispatch("check-errors");
		} else {
			errors = {};
		}
	}

	function checkErrors(data: Output<ObjectSchema<any, any>>) {
		let result = null;
		try {
			result = schema.parse(data);
		} catch (error) {
			if (error instanceof ValiError) {
				const flatErrors = flatten(error);
				for (const path in flatErrors.nested) {
					for (const err in flatErrors.nested[path]) {
						if (path && !errors[path]) errors[path] = err;
					}
				}
			}
		}

		return result;
	}

	$: {
		if (Object.values(errors).length) {
			dispatch("errors", errors);
		} else {
			dispatch("errors", null);
		}
	}

	const inputChanged = (ev: Event) => {
		const name = (ev.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.getAttribute("name");
		if (name) addChanges(name);
	};

	$: {
		if (elForm && data) {
			setTimeout(() => {
				elForm.querySelectorAll("input, textarea, select").forEach((el) => el.addEventListener("input", inputChanged));
			}, 10);
		}
	}

	beforeNavigate((nav) => {
		if (changes.size) {
			if (!confirm("You have unsaved changes. Are you sure you want to leave this page?")) nav.cancel();
		}
	});
</script>

<form
	method="POST"
	{action}
	bind:this={elForm}
	use:enhance={(f) => {
		dispatch("before-submit");
		savedChanges = new Set([...changes]);
		changes.clear();
		form = null;
		saving = true;

		checkErrors(data);
		if (Object.values(errors).find((e) => e.length > 0)) {
			saving = false;
			return f.cancel();
		}

		if (stringify) f.formData.append(stringify, JSON.stringify(data));
		return async ({ update, result }) => {
			await update({ reset: resetOnSave });
			dispatch("after-submit", result);
			if (!["redirect", "success"].includes(result.type)) {
				changes = new Set([...savedChanges]);
				savedChanges.clear();
			}
		};
	}}
>
	<slot />
</form>
