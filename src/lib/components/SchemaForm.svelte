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
	export let errors = emptyClone(data);

	let changes = new SvelteSet<string>();
	function addChanges(field: string) {
		changes = changes.add(field);
	}

	$: changes && checkErrors(data);

	async function checkErrors(data: InferIn<TSchema>, onlyChanges = true) {
		errors = emptyClone(data);
		const result = await validate(schema, data);
		if ("data" in result) {
			dispatch("validate", { data: result.data });
		} else if ("issues" in result) {
			result.issues.forEach((issue) => {
				if (issue.path && (!onlyChanges || changes.has(issue.path.join(".")))) {
					errors = setNestedError(errors, issue.path, issue.message);
				}
			});
			dispatch("validate", { errors });
		}
	}

	$: dispatch("errors", errors);

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
		[K in keyof T]: T[K] extends Date ? string : T[K] extends object ? DeepStringify<T[K]> : string;
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

	function setNestedError<T extends DeepStringify<object>>(err: T, keysArray: (string | number | symbol)[], value: string) {
		let current = err;
		for (let i = 0; i < keysArray.length - 1; i++) {
			const key = keysArray[i] as keyof T;
			if (!(key in current)) throw new Error(`Key ${keysArray.slice(0, i + 1).join(".")} not found`);
			if (!["Object", "Array"].includes((current[key] as object).constructor.name))
				throw new Error(`Cannot set nested error on non-object ${keysArray.slice(0, i + 1).join(".")}`);
			current = current[key];
		}
		const key = keysArray[keysArray.length - 1] as keyof T;
		if (!(key in current)) throw new Error(`Key ${keysArray.join(".")} not found`);
		if (typeof current[key] === "string") current[key] = value.trim() as T[keyof T];
		else throw new Error(`Cannot set nested error on ${keysArray.join(".")}`);
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
