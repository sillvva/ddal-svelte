<script lang="ts" context="module">
	type FormObj = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends FormObj">
	import { dev } from "$app/environment";
	import { onMount } from "svelte";
	import type { HTMLFormAttributes } from "svelte/elements";
	import type { Unsubscriber } from "svelte/store";
	import SuperDebug, { type SuperForm } from "sveltekit-superforms";
	import FormMessage from "./FormMessage.svelte";

	interface $$Props extends HTMLFormAttributes {
		superform: SuperForm<T, any>;
		showMessage?: boolean;
	}

	$: rest = $$restProps as HTMLFormAttributes | undefined;

	export let superform: SuperForm<T, any>;
	export let showMessage = false;

	$: showMessage = !superform.options.resetForm;

	const { form, enhance, submitting, errors, allErrors, message, capture, restore } = superform;
	const method = rest?.method || "post";
	let submitted = false;

	function formstate(refForm: HTMLFormElement) {
		const unsubscribers: Unsubscriber[] = [];
		const eventListeners: [Element, EventListener][] = [];

		refForm.querySelectorAll("input, select, textarea, button").forEach((el) => {
			const name = el.getAttribute("name");
			if (name) {
				const label = refForm.querySelector(`label[for="${name}"]`);
				if (label) el.setAttribute("id", name);
			}

			const disabled = el.hasAttribute("disabled");
			unsubscribers.push(
				submitting.subscribe((submitting) => {
					if (submitting) submitted = true;
					if (submitting) el.setAttribute("disabled", "disabled");
					else if (!disabled && ((showMessage && $message) || $allErrors.length)) el.removeAttribute("disabled");
				})
			);

			const listener = () => {
				submitted = false;
			};
			el.addEventListener("input", listener);
			eventListeners.push([el, listener]);
		});

		refForm.querySelectorAll(`[type="submit"]`).forEach((el) => {
			unsubscribers.push(
				allErrors.subscribe((errors) => {
					if (errors.length) el.setAttribute("disabled", "disabled");
					else el.removeAttribute("disabled");
				})
			);
		});

		return {
			destroy() {
				unsubscribers.forEach((unsub) => unsub());
				eventListeners.forEach(([el, listener]) => el.removeEventListener("input", listener));
			}
		};
	}

	onMount(() => {
		superform.reset();
	});

	export const snapshot = {
		capture,
		restore
	};
</script>

{#if showMessage}
	<FormMessage {message} />
{/if}

{#if submitted && $allErrors.length}
	<div class="alert alert-error mb-4 items-start shadow-lg">
		<span class="iconify size-6 mdi-alert-circle" />
		<div>
			<h2 class="font-bold">
				There {#if $allErrors.length > 1}were errors{:else}was an error{/if} with your submission:
			</h2>
			<svelte:element this={$allErrors.length > 1 ? "ul" : "div"}>
				{#each $allErrors as error}
					{#each error.messages as message}
						{@const path = error.path
							.replace(/\.?_errors/g, "")
							.replace(/\./g, " ")
							.replace("dm", "DM")
							.split(" ")
							.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(" ")
							.trim()}
						<svelte:element this={$allErrors.length > 1 ? "li" : "p"}>
							{#if path.length}
								{path}: {message}
							{:else}
								{message}
							{/if}
						</svelte:element>
					{/each}
				{/each}
			</svelte:element>
		</div>
	</div>
{/if}

<form {method} {...rest} use:enhance use:formstate>
	<div class="grid grid-cols-12 gap-4">
		<slot />
	</div>
</form>

{#if dev}
	<div class="my-4">
		<SuperDebug data={{ $form, $errors }} />
	</div>
{/if}
