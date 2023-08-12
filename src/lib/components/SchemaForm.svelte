<script lang="ts" context="module">
	export type DeepStringify<T> = {
		[K in keyof T]: T[K] extends Date ? string : T[K] extends object ? DeepStringify<T[K]> : string;
	};

	export function schemaErrors<S extends Schema, T extends InferIn<S>>(data: T): DeepStringify<T> {
		const result: any = Array.isArray(data) ? [] : {};
		for (const key in data) {
			if (Array.isArray(data[key])) {
				result[key] = schemaErrors(data[key]);
			} else if (data[key] && typeof data[key] === "object" && !((data[key] as object) instanceof Date)) {
				result[key] = schemaErrors(data[key]);
			} else {
				result[key] = "";
			}
		}
		return result;
	}
</script>

<script lang="ts" generics="TSchema extends Schema">
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { Infer, InferIn, Schema } from "@decs/typeschema";
	import { validate } from "@decs/typeschema";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";
	import { SvelteSet } from "../store";

	const dispatch = createEventDispatcher<{
		"before-submit": null;
		"after-submit": ActionResult;
		errors: typeof errors;
		validate: { data?: Infer<TSchema>; errors?: typeof errors };
	}>();

	let elForm: HTMLFormElement;
	let stringify = "form";

	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let action: string;
	export let method = "POST";
	export let resetOnSave = false;
	export let saving = false;
	export let errors = schemaErrors(data);

	let changes = new SvelteSet<string>();
	function addChanges(field: string) {
		changes = changes.add(field);
	}

	$: changes && checkErrors(data);

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = schemaErrors(data);
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: result.data });
		} else if ("issues" in result) {
			result.issues.forEach((issue) => {
				if (issue.path && (!onlyChanges || changes.has(issue.path.join(".")))) {
					setNestedError(errors, issue.path, issue.message);
					errors = errors;
				}
			});
			dispatch("validate", { errors });
		}
	}

	$: dispatch("errors", errors);

	const inputChanged = (ev: Event) => {
		const name = (ev.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.getAttribute("name");
		if (name) addChanges(name);
	};

	$: {
		if (elForm && data) {
			setTimeout(() => {
				if (elForm)
					elForm.querySelectorAll("input, textarea, select").forEach((el) => el.addEventListener("input", inputChanged));
			}, 10);
		}
	}

	beforeNavigate((nav) => {
		if (changes.size) {
			if (!confirm("You have unsaved changes. Are you sure you want to leave this page?")) nav.cancel();
		}
	});

	const hasValues = (obj: Record<string, unknown>): boolean => {
		return Object.values(obj).some((v) => (typeof v == "object" ? hasValues(v as Record<string, unknown>) : v));
	};

	const setNestedError = <T,>(err: T, keysArray: (string | number | symbol)[], value: string) => {
		let current: any = err;
		for (let i = 0; i < keysArray.length - 1; i++) {
			const key = keysArray[i];
			if (!(current[key] instanceof Object)) {
				current[key] = {};
			}
			current = current[key];
		}
		current[keysArray[keysArray.length - 1]] = value;
	};
</script>

<form
	{method}
	{action}
	{...$$restProps}
	bind:this={elForm}
	use:enhance={(f) => {
		dispatch("before-submit");
		const savedChanges = new SvelteSet([...changes]);
		changes = changes.clear();
		saving = true;

		checkErrors(data, false);
		if (hasValues(errors)) {
			saving = false;
			return f.cancel();
		}

		if (stringify && data && typeof data === "object" && !(stringify in data)) f.formData.append(stringify, JSON.stringify(data));
		return async ({ update, result }) => {
			await update({ reset: resetOnSave });
			dispatch("after-submit", result);
			if (
				(result.type === "success" && result.data && "error" in result.data) ||
				!["redirect", "success"].includes(result.type)
			) {
				changes = new SvelteSet([...savedChanges]);
				savedChanges.clear();
				saving = false;
			}
		};
	}}
>
	<slot />
</form>
