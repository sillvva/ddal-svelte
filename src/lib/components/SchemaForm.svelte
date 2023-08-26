<script lang="ts" context="module">
	import type { Infer, InferIn, Schema } from "@decs/typeschema";
	import { validate } from "@decs/typeschema";

	const stringify = "validated";

	export async function parseFormData<TSchema extends Schema>(formData: FormData, schema: TSchema): Promise<Infer<TSchema>> {
		const data = (formData.get(stringify) as string) || "{}";
		const result = await validate(schema, JSON.parse(data));
		if ("issues" in result && result.issues.length) {
			throw new Error(result.issues.map((i) => i.message).join("\n"));
		}
		if (!("data" in result)) throw new Error("No data returned");
		return result.data;
	}
</script>

<script lang="ts" generics="TSchema extends Schema">
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";

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
	let validatedData: Infer<Schema>;
	let changes: Array<string> = [];

	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let action: string;
	export let method = "POST";
	export let resetOnSave = false;
	export let saving = false;
	export let errors = { form: "", ...emptyClone(data) };

	let initialErrors = structuredClone(errors);
	function addError(keysArray: Array<string | number | symbol>, value: string) {
		errors = setNestedError(errors, keysArray, value);
	}

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = { form: "", ...emptyClone(data) };
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: (validatedData = result.data), changes, errors, addError });
		} else if ("issues" in result) {
			result.issues.forEach((issue) => {
				if (!issue.path) issue.path = ["form"];
				if (!onlyChanges || changes.includes(issue.path.join("."))) {
					addError(issue.path, issue.message);
				}
			});
			dispatch("validate", { changes, errors, addError });
		}
	}

	$: {
		if (elForm && data) {
			setTimeout(() => {
				if (elForm) {
					elForm.querySelectorAll("input, textarea, select").forEach((el) =>
						el.addEventListener("input", (ev: Event) => {
							if (ev.currentTarget instanceof Element && !ev.currentTarget.hasAttribute("data-dirty")) {
								ev.currentTarget.setAttribute("data-dirty", "");
								checkChanges();
							}
						})
					);
				}
			}, 10);
		}
	}

	$: elForm && data && checkChanges();
	function checkChanges() {
		const formStructureIsDiff = JSON.stringify(emptyClone(errors)) !== JSON.stringify(initialErrors);
		changes = [...elForm.querySelectorAll("[data-dirty]")]
			.map((el) => el.getAttribute("name") || "hidden")
			.concat(formStructureIsDiff ? "form" : "")
			.filter(Boolean);

		checkErrors(data);
	}

	beforeNavigate((nav) => {
		checkChanges();
		if (changes.length) {
			if (!confirm("You have unsaved changes. Are you sure you want to leave this page?")) nav.cancel();
		}
	});

	function hasValues(obj: object): boolean {
		return Object.values(obj).some((v) => (v && typeof v == "object" ? hasValues(v) : v));
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
	novalidate
	use:enhance={async (f) => {
		dispatch("before-submit");
		const savedChanges = [...changes];
		changes = [];
		saving = true;

		await checkErrors(data, false);
		if (hasValues(errors)) {
			saving = false;
			return f.cancel();
		}

		if (validatedData && typeof validatedData === "object" && !(stringify in validatedData)) {
			for (const key of [...f.formData.keys()]) {
				if (key === stringify) continue;
				if (f.formData.get(key) instanceof File) continue;
				f.formData.delete(key);
			}
			f.formData.set(stringify, JSON.stringify(validatedData));
		}

		return async ({ update, result }) => {
			await update({ reset: resetOnSave });
			dispatch("after-submit", result);
			if (
				(result.type === "success" && result.data && "error" in result.data) ||
				!["redirect", "success"].includes(result.type)
			) {
				changes = [...savedChanges];
				saving = false;
			}
		};
	}}
>
	<slot {errors} {saving} />
</form>
