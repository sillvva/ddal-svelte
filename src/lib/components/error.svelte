<script lang="ts">
	import { browser, dev } from "$app/environment";
	import { page } from "$app/state";
	import { logClientError } from "$lib/remote/admin/actions.remote";
	import { getAuth } from "$lib/stores.svelte";
	import { omit } from "@sillvva/utils";
	import { useOs } from "@svelteuidev/composables";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";

	interface Props {
		error: unknown;
		boundary?: string;
	}

	let { error, boundary }: Props = $props();

	function hasKey<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
		return obj !== null && typeof obj === "object" && key in obj;
	}

	let message =
		typeof error === "string"
			? error
			: hasKey(error, "message") && typeof error.message === "string"
				? error.message
				: "Something went wrong";

	console.error(error);
	if (browser && message !== "Something went wrong") {
		logClientError({
			message: message,
			name: hasKey(error, "name") && typeof error.name === "string" ? error.name : undefined,
			stack: hasKey(error, "stack") && typeof error.stack === "string" ? error.stack : undefined,
			cause: hasKey(error, "cause") ? error.cause : undefined,
			boundary
		});
	}

	let display = $state(!dev);

	const os = useOs();
</script>

<svelte:boundary>
	<div class="flex flex-1 flex-col items-center justify-center p-4">
		{#if !display}
			<div class="font-vecna mb-12 flex flex-col items-center text-3xl font-bold sm:text-5xl md:text-6xl">
				<img src="/images/confused-goblin.webp" alt="Error" class="mb-2 size-80 max-lg:size-65 max-sm:size-50" />
				<h1>Rolled a Natural 1!</h1>
			</div>
		{/if}
		<div class="alert alert-error mb-4 flex w-full max-w-3xl gap-4 shadow-lg">
			<span class="iconify mdi--alert-circle max-xs:hidden size-6"></span>
			<div class={["flex flex-1 gap-2", message.length >= 150 && "max-md:flex-col"]}>
				<div class="flex flex-1 flex-col justify-center">
					<h3 class="font-bold">Error!</h3>
					<div class="whitespace-pre-line">
						{message}
					</div>
				</div>
				{#if !display}
					<div class="flex items-center gap-2 max-sm:self-end">
						<button class="btn btn-sm max-sm:hidden" onclick={() => (display = true)}>View details</button>
					</div>
				{/if}
			</div>
		</div>
		{#if display}
			{@const { user } = await getAuth()}
			<div class="flex max-w-full flex-col gap-4">
				{#if hasKey(error, "stack") && typeof error.stack === "string"}
					<pre class="bg-base-200 w-full overflow-x-scroll rounded-lg p-4">{@html error.stack}</pre>
				{/if}
				<SuperDebugRuned
					data={{
						error: message,
						boundary,
						...omit(page, ["error"]),
						os,
						user,
						data: undefined
					}}
				/>
			</div>
		{/if}
	</div>
</svelte:boundary>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
