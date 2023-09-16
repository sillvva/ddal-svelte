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

	let elForm: HTMLFormElement;
	let validatedData: Infer<Schema>;
	let changes: Array<string> = [];

	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let action: string;
	export let method = "POST";
	export let resetOnSave = false;
	export let saving = false;
	export let errors = new SvelteMap<"form" | Paths<InferIn<TSchema>>, string>();

	let initialErrors = structuredClone(errors);

	async function checkErrors(data: InferIn<TSchema>) {
		errors = new SvelteMap<"form" | Paths<InferIn<TSchema>>, string>();
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: (validatedData = result.data), changes, errors, setError });
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

	function checkChanges() {
		const formStructureIsDiff = JSON.stringify(emptyClone(errors)) !== JSON.stringify(initialErrors);
		changes = !saving
			? [...elForm.querySelectorAll("[data-dirty]")]
					.map((el) => el.getAttribute("name") || "hidden")
					.concat(formStructureIsDiff ? "form" : "")
					.filter(Boolean)
			: [];

		checkErrors(data);
	}

	$: {
		if (saving || (elForm && data)) {
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

	function setError<K extends "form" | Paths<InferIn<TSchema>>>(path: K, message: string) {
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

		await checkErrors(data);
		if (errors.size) {
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
				saving = false;
			}
		};
	}}
>
	<slot {errors} {saving} />
</form>
