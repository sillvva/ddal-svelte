import { searchData } from "$lib/stores";
import { toast } from "svelte-sonner";
import { get } from "svelte/store";
import { superForm, type FormOptions, type FormPathLeaves, type SuperValidated } from "sveltekit-superforms";
import { valibotClient } from "sveltekit-superforms/adapters";
import type { BaseSchema, Input, Output } from "valibot";

export function successToast(message?: string) {
	toast.success("Success", {
		description: message,
		classes: {
			description: "!text-white"
		}
	});
}

export function errorToast(message?: string) {
	toast.error("Error", {
		description: message,
		classes: {
			description: "!text-white"
		},
		duration: 30000
	});
}

interface CustomFormOptions<S extends BaseSchema> {
	nameField?: FormPathLeaves<Output<S>, string>;
}

export function valibotForm<S extends BaseSchema, Out extends Output<S>, In extends Input<S>>(
	form: SuperValidated<Out, App.Superforms.Message, In>,
	schema: S,
	options?: FormOptions<Out, App.Superforms.Message, In> & CustomFormOptions<S>
) {
	const superform = superForm(form, {
		dataType: "json",
		validators: valibotClient(schema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?",
		...options,
		onResult(event) {
			if (["success", "redirect"].includes(event.result.type)) {
				const nameField = options?.nameField || "name";
				if (nameField) {
					const data = get(superform.form);
					successToast(`${data[nameField]} saved`);
				}
				searchData.set([]);
			}
			options?.onResult?.(event);
		},
		onError(event) {
			errorToast(event.result.error.message);
			if (options?.onError instanceof Function) options?.onError(event);
		}
	});
	return superform;
}
