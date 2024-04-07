import { searchData } from "$lib/stores";
import { parseDateTime, type DateValue } from "@internationalized/date";
import { toast } from "svelte-sonner";
import { derived, get, type Readable, type Writable } from "svelte/store";
import {
	dateProxy,
	fieldProxy,
	superForm,
	type FormOptions,
	type FormPathLeaves,
	type FormPathType,
	type SuperForm,
	type SuperValidated
} from "sveltekit-superforms";
import { valibotClient } from "sveltekit-superforms/adapters";
import type { BaseSchema, Input, Output } from "valibot";

export function successToast(message: string) {
	toast.success("Success", {
		description: message,
		classes: {
			description: "!text-white"
		}
	});
}

export function errorToast(message: string) {
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

type ArgumentsType<T> = T extends (...args: infer U) => unknown ? U : never;
type IntDateProxyOptions = Omit<NonNullable<ArgumentsType<typeof dateProxy>[2]>, "format">;

export function intDateProxy<T extends Record<string, unknown>, Path extends FormPathLeaves<T, Date>>(
	form: Writable<T> | SuperForm<T>,
	path: Path,
	options?: IntDateProxyOptions
): Writable<DateValue | undefined> {
	function toValue(value?: DateValue) {
		if (!value && options?.empty !== undefined) {
			return options.empty === "null" ? null : undefined;
		}

		return value && new Date(value.toString());
	}

	function dateToDV(date: Date) {
		return parseDateTime(
			date
				.toLocaleDateString("sv", {
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit"
				})
				.replace(" ", "T")
		);
	}

	const realProxy = fieldProxy(form, path, { taint: options?.taint });

	let updatedValue: DateValue | undefined = undefined;
	let initialized = false;

	const proxy: Readable<DateValue | undefined> = derived(realProxy, (value: unknown) => {
		if (!initialized) {
			initialized = true;
		}

		// Prevent proxy updating itself
		if (updatedValue !== undefined) {
			const current = updatedValue;
			updatedValue = undefined;
			return current;
		}

		if (value instanceof Date) return dateToDV(value);

		return undefined;
	});

	return {
		subscribe: proxy.subscribe,
		set(val: DateValue | undefined) {
			updatedValue = val;
			const newValue = toValue(updatedValue) as FormPathType<T, Path>;
			realProxy.set(newValue);
		},
		update(updater) {
			realProxy.update((f) => {
				updatedValue = updater(dateToDV(f as Date));
				const newValue = toValue(updatedValue) as FormPathType<T, Path>;
				return newValue;
			});
		}
	};
}
