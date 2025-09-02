<script lang="ts">
	import { dev } from "$app/environment";
	import { afterNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import LoadingPanel from "$lib/components/LoadingPanel.svelte";
	import AppAPI from "$lib/remote/app";
	import SuperDebug from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import * as v from "valibot";

	let previousPage = $state<string>(resolve("/"));
	let display = $state(!dev);

	afterNavigate(({ from }) => {
		previousPage = from?.url.pathname || previousPage;
	});

	function checkForUUIDs() {
		if (page.status === 404 && page.error?.message === "Not Found") {
			const url = page.url.pathname;
			const segments = url.split("/");
			return (
				segments
					.filter((segment) => segment.split("-").length === 5)
					.filter((uuid) => v.safeParse(v.pipe(v.string(), v.uuid()), uuid).success).length > 0
			);
		}

		return false;
	}

	const type = $derived.by(() => {
		if (!checkForUUIDs()) return "warning";
		return "error";
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center">
	{#if !display}
		<h1 class="font-vecna mb-12 text-4xl font-bold">Rolled a Natural 1!</h1>
	{/if}
	<div class={twMerge("alert alert-error mb-4 w-full max-w-3xl shadow-lg", type === "warning" && "alert-warning")}>
		<span class="iconify mdi--alert-circle size-6"></span>
		<div class="flex flex-col">
			<h3 class="font-bold">
				{#if !checkForUUIDs()}
					Don't panic!
				{:else}
					Error {page.status}!
				{/if}
			</h3>
			{#if !checkForUUIDs()}
				<div class="text-xs">
					Database IDs have been changed from CUIDs to UUIDs. This will break existing links to characters, but no data has been
					lost. You will still be able to access your characters using the new UUID going forward. Click <kbd
						class="strong kbd kbd-sm text-base-content">Go back</kbd
					> to be returned to your characters.
				</div>
			{:else}
				<div class="text-xs whitespace-pre-line">
					{page.error?.message || "Something went wrong"}
				</div>
			{/if}
		</div>
		{#if !display}
			<button class="btn btn-sm" onclick={() => (display = true)}>View details</button>
		{/if}
		<a href={previousPage} class="btn btn-sm">Go back</a>
	</div>
	{#if display}
		<svelte:boundary>
			{@const request = await AppAPI.queries.request()}

			{#snippet pending()}
				<LoadingPanel />
			{/snippet}

			<SuperDebug
				data={{
					...page,
					isMobile: request.isMobile,
					user: request.user,
					data: undefined
				}}
			/>
		</svelte:boundary>
	{:else}
		<img src="/images/nat1.webp" alt="Error" class="size-80" />
	{/if}
</div>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
