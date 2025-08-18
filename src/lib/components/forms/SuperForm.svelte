<script lang="ts">
	import { dev } from "$app/environment";
	import { beforeNavigate, goto, invalidateAll } from "$app/navigation";
	import type { Pathname } from "$app/types";
	import { taintedMessage } from "$lib/factories.svelte";
	import type { EffectFailure, EffectResult } from "$lib/server/effect/runtime";
	import { onMount, type Snippet } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { SuperForm, SuperValidated } from "sveltekit-superforms";
	import SuperDebug from "sveltekit-superforms/SuperDebug.svelte";
	import FormMessage from "./FormMessage.svelte";

	type FormAttributes = Omit<HTMLFormAttributes, "hidden">;
	type T = $$Generic<Record<PropertyKey, unknown>>;
	type TForm = $$Generic<SuperValidated<T, App.Superforms.Message>>;
	type TRemoteCommand = $$Generic<((data: T) => Promise<EffectResult<TForm | Pathname>>) & { pending: number }>;

	interface Props extends Omit<FormAttributes, "action"> {
		superform: SuperForm<T, App.Superforms.Message>;
		children?: Snippet;
	}

	interface ActionProps extends Props {
		action: string;
		remote?: never;
		onRemoteSuccess?: never;
		onRemoteError?: never;
	}

	interface RemoteProps extends Props {
		action?: never;
		remote?: TRemoteCommand;
		onRemoteSuccess?: (data: T) => void;
		onRemoteError?: (error: EffectFailure["error"]) => void;
	}

	let { superform, children, action, remote, onRemoteSuccess, onRemoteError, ...rest }: ActionProps | RemoteProps = $props();
	const { form, errors, message, capture, restore, validateForm, submit, submitting, tainted } = superform;

	const method = $derived(remote ? "post" : rest.method || "post");
	const isSubmitting = $derived($submitting || !!remote?.pending);

	onMount(() => {
		superform.reset();
	});

	function errorMessage(error: string) {
		console.error(error);
		if (typeof error === "string") {
			if (error.trim()) $errors = { _errors: [error] };
			else $errors = { _errors: ["An unknown error occurred"] };
		}
	}

	function checkUnload() {
		if ($tainted) return confirm(taintedMessage);
		return true;
	}

	$effect(() => {
		window.addEventListener("beforeunload", checkUnload);
		return () => {
			window.removeEventListener("beforeunload", checkUnload);
		};
	});

	beforeNavigate(({ cancel }) => {
		if (!checkUnload()) cancel();
	});

	export const snapshot = {
		capture,
		restore
	};
</script>

<div class="flex flex-col gap-4">
	<FormMessage {message} />

	{#if $errors._errors?.[0]}
		<div class="alert alert-error shadow-lg">
			<span class="iconify mdi--alert-circle size-6"></span>
			{$errors._errors[0]}
		</div>
	{/if}

	<form
		{...rest}
		{method}
		{action}
		onsubmit={async (e) => {
			e.preventDefault();
			if (!remote) return submit(e);

			const r = await validateForm({ update: true });
			if (!r.valid) return;

			const result = await remote($form);
			if (result.ok) {
				if (typeof result.data === "string") {
					$tainted = undefined;
					onRemoteSuccess?.($form);
					await invalidateAll();
					return goto(result.data);
				}

				const errorsFields = Object.keys(result.data.errors);
				if (errorsFields.length) {
					$errors = result.data.errors;
				} else {
					await invalidateAll();
					onRemoteSuccess?.($form);
				}

				$form = result.data.data;
				$message = result.data.message;
			} else {
				onRemoteError?.(result.error);
				if (result.error.extra.redirectTo && typeof result.error.extra.redirectTo === "string") {
					goto(result.error.extra.redirectTo);
				} else {
					errorMessage(result.error.message);
				}
			}
		}}
	>
		<fieldset class="grid grid-cols-12 gap-4" disabled={isSubmitting}>
			{@render children?.()}
		</fieldset>
	</form>

	{#if dev}
		<SuperDebug data={{ $form, $errors, $message, isSubmitting, $tainted }} />
	{/if}
</div>
