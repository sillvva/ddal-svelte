<script lang="ts">
	import { dev } from "$app/environment";
	import { page } from "$app/state";
	import { getGlobal } from "$lib/stores.svelte";
	import { omit } from "@sillvva/utils";
	import { useOs } from "@svelteuidev/composables";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";

	interface Props {
		error: unknown;
	}

	let { error }: Props = $props();

	let message = $derived(
		typeof error === "string"
			? error
			: typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
				? error.message
				: "Something went wrong"
	);

	console.error(error);

	let display = $state(!dev);

	const global = getGlobal();
	const os = useOs();
</script>

<div class="flex flex-1 flex-col items-center justify-center p-4">
	{#if !display}
		<div class="font-vecna mb-12 flex flex-col items-center text-3xl font-bold sm:text-5xl md:text-6xl">
			<img src="/images/nat1.webp" alt="Error" class="mb-2 size-50 max-lg:size-40 max-sm:size-30" />
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
		<SuperDebugRuned
			data={{
				error,
				...omit(page, ["error"]),
				os: os,
				user: global.user,
				data: undefined
			}}
		/>
	{/if}
</div>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
