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
		validate: {
			data?: Infer<TSchema>;
			changes: typeof changes;
			errors: typeof errors;
			addError: typeof addError;
		};
	}>();

	let elForm: HTMLFormElement;
	let stringify = "form";

	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let action: string;
	export let method = "POST";
	export let resetOnSave = false;
	export let saving = false;
	export let errors = { form: "", ...emptyClone(data) };

	let changes = new SvelteSet<string>();
	function addChanges(field: string) {
		if (changes.has(field)) return;
		changes = changes.add(field);
	}

	$: checkErrors(data);
	function addError(keysArray: Array<string | number | symbol>, value: string) {
		errors = setNestedError(errors, keysArray, value);
	}

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = {
			form: "",
			...emptyClone(data)
		};
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: result.data, changes, errors, addError });
		} else if ("issues" in result) {
			result.issues.forEach((issue) => {
				if (!issue.path) issue.path = ["form"];
				if (!onlyChanges || changes.has(issue.path.join("."))) {
					addError(issue.path, issue.message);
				}
			});
			dispatch("validate", { changes, errors, addError });
		}
	}

	function inputChanged(ev: Event) {
		const name = (ev.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null)?.getAttribute("name");
		if (name) addChanges(name);
	}

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

	function hasValues(obj: Record<string, unknown>): boolean {
		return Object.values(obj).some((v) => (typeof v == "object" ? hasValues(v as Record<string, unknown>) : v));
	}

	type DeepStringify<T> = {
		[K in keyof T]: T[K] extends Array<infer E>
			? DeepStringify<Array<E>>
			: T[K] extends Date | Blob | File
			? string
			: T[K] extends Object
			? DeepStringify<T[K]>
			: string;
	};

	function emptyClone<S extends Schema, T extends InferIn<S>>(data: T): DeepStringify<T> {
		const result: any = Array.isArray(data) ? [] : {};
		for (const key in data) {
			if (data[key] && ["Object", "Array"].includes((data[key] as object).constructor.name)) {
				result[key] = emptyClone(data[key]);
			} else result[key] = "";
		}
		return result;
	}

	function setNestedError<TErrorObj extends object>(
		err: TErrorObj,
		keysArray: Array<string | number | symbol>,
		value: string,
		previousKeys: Array<string | number | symbol> = []
	) {
		if (!keysArray.length) throw new Error("Keys array must have at least one key");
		const key = keysArray.shift() as keyof TErrorObj;
		const path = [...previousKeys, key]
			.map((c, i) => {
				if (typeof c === "number") return `[${c}]`;
				return `${i == 0 ? "" : "."}${c.toString()}`;
			})
			.join("");
		if (!(key in err)) throw new Error(`Key ${path} not found`);
		if (keysArray.length && ["Object", "Array"].includes((err[key] as object).constructor.name)) {
			err[key] = setNestedError(err[key], keysArray, value, [...previousKeys, key]);
		} else {
			if (keysArray.length) throw new Error(`Cannot set nested error on non-object ${path}`);
			if (!err[key]) err[key] = value.trim() as TErrorObj[keyof TErrorObj];
		}
		return err;
	}
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
	<slot {errors} {saving} />
</form>
