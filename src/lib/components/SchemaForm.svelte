<script lang="ts">
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";
	import type { ObjectSchema, Output } from "valibot";
	import { ValiError } from "valibot";

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
		else if (form && saving) changes = [];
	}

	export let changes: string[] = [];
	let savedChanges: string[] = [];
	export function addChanges(field: string) {
		changes = [...changes.filter((c) => c !== field), field];
	}

	export let errors: Record<string, string> = {};
	$: {
		if (changes.length) {
			changes.forEach((c) => {
				errors[c] = "";
			});
			try {
				schema.parse(data);
			} catch (error) {
				changes.forEach((c) => {
					if (error instanceof ValiError) {
						error.issues.forEach((issue) => {
							const path = issue.path?.map((p) => p.key).join(".");
							console.log(path, issue.path);
							if (path === c) errors[c] = issue.message;
						});
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
				error.issues.forEach((issue) => {
					const path = issue.path?.map((p) => p.key).join(".");
					if (path) errors[path] = issue.message;
				});
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
		if (changes.length) {
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
		savedChanges = [...changes];
		changes = [];
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
			if (result.type !== "redirect") {
				changes = [...savedChanges];
				savedChanges = [];
			}
		};
	}}
>
	<slot />
</form>
