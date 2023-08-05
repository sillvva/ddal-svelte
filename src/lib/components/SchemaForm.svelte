<script lang="ts" generics="TSchema extends BaseSchema | BaseSchemaAsync">
	// TSchema extends Schema
	// TSchema extends BaseSchema | BaseSchemaAsync
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { BaseSchema, BaseSchemaAsync, Input, Output } from "valibot";
	import { ValiError, flatten } from "valibot";
	// import type { Infer, InferIn, Schema } from "@decs/typeschema";
	// import { validate } from "@decs/typeschema";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";
	import { SvelteMap, SvelteSet } from "../store";

	type InferIn<TInput extends TSchema> = Input<TInput>;
	type Infer<TOutput extends TSchema> = Output<TOutput>;

	const dispatch = createEventDispatcher<{
		"before-submit": null;
		"after-submit": ActionResult;
		errors: SvelteMap<string, string>;
		validate: { data?: Infer<TSchema>; errors: SvelteMap<string, string> };
	}>();

	let elForm: HTMLFormElement;

	export let form: (Record<string, unknown> & { error: unknown }) | null;
	export let schema: TSchema;
	export let data: InferIn<TSchema>;
	export let validatedData: Infer<TSchema> | undefined = undefined;
	export let action: string;
	export let stringify = "";
	export let resetOnSave = false;
	export let saving = false;

	$: {
		if (form) {
			if ("error" in form && saving) saving = false;
			else if (saving) changes = changes.clear();
		}
	}

	export let changes = new SvelteSet<string>();
	export function addChanges(field: string) {
		changes = changes.add(field);
	}

	export let errors = new SvelteMap<string, string>();
	$: checkErrors(data);

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = errors.clear();
		// const result = await validate(schema, data);
		// if ("issues" in result) {
		// 	result.issues.forEach((issue) => {
		// 		if (issue.path && (!onlyChanges || changes.has(issue.path.join(".")))) {
		// 			errors = errors.set(issue.path.join("."), issue.message);
		// 		}
		// 	});
		// }
		// if ("data" in result) {
		// 	validatedData = result.data;
		// }
		try {
			validatedData = schema.parse(data);
		} catch (error) {
			if (error instanceof ValiError) {
				const flatErrors = flatten(error);
				for (const path in flatErrors.nested) {
					for (const err of flatErrors.nested[path] || []) {
						if (!onlyChanges || changes.has(path)) errors = errors.set(path, err);
					}
				}
			}
		}
		dispatch("validate", { data: validatedData, errors });
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
</script>

<form
	method="POST"
	{action}
	bind:this={elForm}
	use:enhance={(f) => {
		dispatch("before-submit");
		const savedChanges = new SvelteSet([...changes]);
		changes.clear();
		saving = true;
		form = null;

		checkErrors(data, false);
		if (Object.values(errors).find((e) => e.length > 0)) {
			saving = false;
			return f.cancel();
		}

		if (stringify) f.formData.append(stringify, JSON.stringify(data));
		return async ({ update, result }) => {
			await update({ reset: resetOnSave });
			dispatch("after-submit", result);
			if (!["redirect", "success"].includes(result.type)) {
				changes = new SvelteSet([...savedChanges]);
				savedChanges.clear();
			}
		};
	}}
>
	<slot />
</form>
