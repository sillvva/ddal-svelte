<script lang="ts" context="module">
	import type { Infer, InferIn, Schema } from "@decs/typeschema";
	import { validate } from "@decs/typeschema";
	import { decode } from "decode-formdata";

	/**
	 * Parse form data from strings to their correct types and
	 * validate them against a schema from Zod, Yup, Valibot, etc.
	 *
	 * @param formData The form data to parse
	 * @param schema The schema to validate against
	 * @param info Arrays of field names that should be parsed as arrays, booleans, dates, files or numbers
	 * @param info.arrays Field names that should be parsed as arrays
	 * @param info.booleans Field names that should be parsed as booleans. "false", "0" or undefined will
	 * be converted to false. Everything else will be converted to true.
	 * @param info.dates Field names that should be parsed as dates. Empty dates will be converted to null.
	 * @param info.files Field names that should be parsed as files
	 * @param info.numbers Field names that should be parsed as numbers
	 *
	 * @returns The parsed and validated data
	 */
	export async function parseFormData<TSchema extends Schema>(
		formData: FormData,
		schema: TSchema,
		info?: Partial<{
			/**
			 * Field names that should be parsed as arrays
			 */
			arrays: string[];
			/**
			 * Field names that should be parsed as booleans. "false", "0" or undefined will
			 * be converted to false. Everything else will be converted to true.
			 */
			booleans: string[];
			/**
			 * Field names that should be parsed as dates. Empty dates will be converted to null.
			 */
			dates: string[];
			/**
			 * Field names that should be parsed as files
			 */
			files: string[];
			/**
			 * Field names that should be parsed as numbers
			 */
			numbers: string[];
		}>
	): Promise<Infer<TSchema>> {
		const formValues = decode(formData, info);
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

	/**
	 * A schema from Zod, Yup, Valibot, etc. to validate the form against
	 */
	export let schema: TSchema;
	/**
	 * The data to be validated
	 */
	export let data: InferIn<TSchema>;
	/**
	 * The URL to submit the form to
	 */
	export let action: string;
	/**
	 * The HTTP method to use when submitting the form
	 */
	export let method = "POST";
	/**
	 * Whether to reset the form after submitting
	 */
	export let resetOnSave = false;

	let initialStructure = emptyClone(data);
	$: currentStructure = emptyClone(data);

	let errors = new SvelteMap<"form" | Paths<typeof initialStructure, 6>, string>();
	let elForm: HTMLFormElement;
	let changes: Array<string> = [];
	let saving = false;

	async function checkChanges() {
		// Check for changes
		const formStructureIsDiff = JSON.stringify(currentStructure) !== JSON.stringify(initialStructure);
		changes = !saving
			? [...elForm.querySelectorAll("[data-dirty]")]
					.map((el) => el.getAttribute("name") || "hidden")
					.concat(formStructureIsDiff ? "form" : "")
					.filter(Boolean)
			: [];

		// Check for errors
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
		if (saving) return f.cancel();

		dispatch("before-submit");
		saving = true;

		// Check for errors before submitting
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
