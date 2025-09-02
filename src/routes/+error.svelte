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

<div
	class={twMerge("flex flex-col items-center justify-center p-4", !display && "-mt-30 min-h-screen max-lg:-mt-20 max-sm:-mt-10")}
>
	{#if !display}
		{#if page.status === 404}
			<img src="/images/d4.webp" alt="404" class="mb-2 size-60 max-lg:size-40 max-sm:size-20" />
			<h1 class="font-vecna mb-12 text-4xl font-bold">4D4: Not Found!</h1>
		{:else}
			<img src="/images/nat1.webp" alt="Error" class="mb-2 size-60 max-lg:size-40 max-sm:size-20" />
			<h1 class="font-vecna mb-12 text-4xl font-bold">Rolled a Natural 1!</h1>
		{/if}
	{/if}
	<div class={twMerge("alert alert-error mb-4 w-full max-w-3xl shadow-lg", type === "warning" && "alert-warning")}>
		<span class="iconify mdi--alert-circle size-6"></span>
		<div class="flex gap-2 max-lg:flex-col">
			<div class="flex flex-1 flex-col">
				<h3 class="font-bold">
					{#if !checkForUUIDs()}
						Don't panic!
					{:else}
						Error {page.status}!
					{/if}
				</h3>
				{#if !checkForUUIDs()}
					<div>
						Database IDs have been changed from CUIDs to UUIDs. This will break existing links to characters, but no data has been
						lost. You will still be able to access your characters using the new UUID going forward. Click <kbd
							class="strong kbd kbd-sm text-base-content">Go back</kbd
						> to be returned to your characters.
					</div>
				{:else}
					<div class="whitespace-pre-line">
						{page.error?.message || "Something went wrong"}
					</div>
				{/if}
			</div>
			<div class="flex items-center gap-2 max-sm:self-end">
				{#if !display}
					<button class="btn btn-sm" onclick={() => (display = true)}>View details</button>
				{/if}
				<a href={previousPage} class="btn btn-sm">Go back</a>
			</div>
		</div>
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
	{/if}
</div>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
