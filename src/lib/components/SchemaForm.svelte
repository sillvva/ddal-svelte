<script lang="ts" generics="TSchema extends BaseSchema | BaseSchemaAsync">
	import { deepStringify, setNestedError } from "../types/util";
	// TSchema extends Schema
	// TSchema extends BaseSchema | BaseSchemaAsync
	import { enhance } from "$app/forms";
	import { beforeNavigate } from "$app/navigation";
	import type { BaseSchema, BaseSchemaAsync, Input, Output } from "valibot";
	import { ValiError } from "valibot";
	// import type { Infer, InferIn, Schema } from "@decs/typeschema";
	// import { validate } from "@decs/typeschema";
	import type { ActionResult } from "@sveltejs/kit";
	import { createEventDispatcher } from "svelte";
	import { SvelteSet } from "../store";

	type InferIn<TInput extends TSchema> = Input<TInput>;
	type Infer<TOutput extends TSchema> = Output<TOutput>;

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

	export let errors = deepStringify(data);

	export let changes = new SvelteSet<string>();
	export function addChanges(field: string) {
		changes = changes.add(field);
	}

	$: changes && checkErrors(data);

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = deepStringify(data);
		// const result = await validate(schema, data);
		// if ("data" in result) {
		// 	dispatch("validate", { data: result.data });
		// }
		// else if ("issues" in result) {
		// 	result.issues.forEach((issue) => {
		// 		if (issue.path && (!onlyChanges || changes.has(issue.path.join(".")))) {
		// 			errors = errors.set(issue.path.join("."), issue.message);
		// 		}
		// 	});
		// 	dispatch("validate", { errors });
		// }
		try {
			dispatch("validate", { data: await schema.parse(data) });
		} catch (error) {
			if (error instanceof ValiError) {
				error.issues.forEach((issue) => {
					if (issue.path && (!onlyChanges || changes.has(issue.path.map((p) => p.key).join(".")))) {
						setNestedError(
							errors,
							issue.path.map((p) => p.key),
							issue.message
						);
						errors = errors;
					}
				});
			}
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
		if (Object.values(errors).find((e) => e.length > 0)) {
			saving = false;
			return f.cancel();
		}

		if (stringify && !(stringify in data)) f.formData.append(stringify, JSON.stringify(data));
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
