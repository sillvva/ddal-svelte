<script lang="ts">
	import { enhance } from "$app/forms";
	import { createEventDispatcher } from "svelte";
	import type { ZodError, z } from "zod";

	const dispatch = createEventDispatcher();

	export let form: object | null;
	export let schema: z.ZodObject<any, any>;
	export let data: object;
	export let action: string;
	export let stringify = "";

	export let saving = false;
	$: {
		if (form && saving) saving = false;
	}

	export let changes: string[] = [];
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
					(error as ZodError).errors
						.filter((e) => e.path[0] === c)
						.forEach((e) => {
							errors[e.path[0].toString()] = e.message;
						});
				});
			}

			dispatch("check-errors");
		} else {
			errors = {};
		}
	}

	function checkErrors(data: z.infer<typeof schema>) {
		let result = null;
		try {
			result = schema.parse(data);
		} catch (error) {
			(error as ZodError).errors.forEach((e) => {
				errors[e.path[0].toString()] = e.message;
			});
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
</script>

<form
	method="POST"
	{action}
	use:enhance={(f) => {
		form = null;
		saving = true;

		dispatch("before-submit");
		console.log(data);

		checkErrors(data);
		if (Object.values(errors).find((e) => e.length > 0)) {
			saving = false;
			return f.cancel();
		}

		if (stringify) f.formData.append(stringify, JSON.stringify(data));
		return async ({ update, result }) => {
			await update({ reset: false });
			if (result.type !== "redirect") saving = false;
			dispatch("save");
		};
	}}
>
	<slot />
</form>
