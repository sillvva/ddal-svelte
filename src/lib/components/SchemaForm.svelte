<script lang="ts" context="module">
	import type { Infer, InferIn, Schema } from "@decs/typeschema";
	import { validate } from "@decs/typeschema";
	import { decode } from "decode-formdata";

	export async function parseFormData<TSchema extends Schema>(
		formData: FormData,
		schema: TSchema,
		info?: Partial<{
			arrays: string[];
			booleans: string[];
			dates: string[];
			files: string[];
			numbers: string[];
		}>
	): Promise<Infer<TSchema>> {
		const formValues = decode(formData, {
			...info,
			dates: info?.dates?.filter((d) => formData.get(d))
		});
		const result = await validate(schema, formValues);
		if ("issues" in result && result.issues.length) {
			console.log("Value:", formValues);
			console.error("Issues:", result.issues);
			throw new Error([...new Set(result.issues.map((i) => i.message))].join(";\n"));
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
	import { SvelteMap, type DeepStringify, type Paths } from "../types/util";

	const dispatch = createEventDispatcher<{
		"before-submit": null;
		"after-submit": ActionResult;
		validate: {
			data?: Infer<TSchema>;
			changes: typeof changes;
			errors: typeof errors;
			setError: typeof setError;
		};
	}>();

	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let action: string;
	export let method = "POST";
	export let resetOnSave = false;

	let initialStructure = emptyClone(data);
	$: currentStructure = emptyClone(data);

	let errors = new SvelteMap<"form" | Paths<typeof initialStructure, 6>, string>();
	let elForm: HTMLFormElement;
	let changes: Array<string> = [];
	let saving = false;

	async function checkChanges() {
		const formStructureIsDiff = JSON.stringify(currentStructure) !== JSON.stringify(initialStructure);
		changes = !saving
			? [...elForm.querySelectorAll("[data-dirty]")]
					.map((el) => el.getAttribute("name") || "hidden")
					.concat(formStructureIsDiff ? "form" : "")
					.filter(Boolean)
			: [];

		errors = new SvelteMap<"form" | Paths<typeof initialStructure, 6>, string>();
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: result.data, changes, errors, setError });
		} else if ("issues" in result) {
			result.issues.forEach((issue) => {
				if (!issue.path) issue.path = ["form"];
				if (saving || changes.includes(issue.path.join("."))) {
					errors = errors.set(issue.path.join(".") as any, issue.message);
				}
			});
			dispatch("validate", { changes, errors, setError });
		}
	}

	$: {
		if (elForm && data) {
			checkChanges();
			setTimeout(() => {
				elForm.querySelectorAll(":is(input, textarea, select):not([data-listener])").forEach((el) => {
					el.setAttribute("data-listener", "");
					el.addEventListener("input", (ev: Event) => {
						if (ev.currentTarget instanceof Element && !ev.currentTarget.hasAttribute("data-dirty")) {
							ev.currentTarget.setAttribute("data-dirty", "");
							checkChanges();
						}
					});
				});
			}, 10);
		}
	}

	beforeNavigate((nav) => {
		checkChanges();
		if (changes.length) {
			if (!confirm("You have unsaved changes. Are you sure you want to leave this page?")) nav.cancel();
		}
	});

	function emptyClone<S extends Schema, T extends InferIn<S>>(data: T): DeepStringify<T> {
		const result: any = Array.isArray(data) ? [] : {};
		for (const key in data) {
			if (data[key] && ["Object", "Array"].includes((data[key] as object).constructor.name)) {
				result[key] = emptyClone(data[key]);
			} else result[key] = "";
		}
		return result;
	}

	function setError<K extends "form" | Paths<typeof initialStructure, 6>>(path: K, message: string) {
		errors = errors.set(path, message);
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
		saving = true;

		await checkChanges();
		if (errors.size) {
			saving = false;
			return f.cancel();
		}

		// Change dates to ISO format in client to prevent timezone issues
		f.formData.forEach((value, key) => {
			const inputType = document.querySelector(`[name="${key}"]`)?.getAttribute("type");
			if (inputType?.includes("date") && typeof value === "string") {
				const d = new Date(value);
				if (!isNaN(d.getTime())) f.formData.set(key, d.toISOString());
			}
		});

		return async ({ update, result }) => {
			await update({ reset: resetOnSave });
			dispatch("after-submit", result);
			if (
				(result.type === "success" && result.data && "error" in result.data) ||
				!["redirect", "success"].includes(result.type)
			) {
				saving = false;
			}
		};
	}}
>
	<slot {errors} {saving} />
</form>
