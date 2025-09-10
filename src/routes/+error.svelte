<script lang="ts">
	import { dev } from "$app/environment";
	import { afterNavigate } from "$app/navigation";
	import { page } from "$app/state";
	import LoadingPanel from "$lib/components/LoadingPanel.svelte";
	import AppAPI from "$lib/remote/app";
	import SuperDebug from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";
	import Layout from "./(app)/+layout.svelte";

	let previousPage = $state<string>("/");
	let display = $state(!dev);

	afterNavigate(({ from }) => {
		previousPage = from?.url.pathname || previousPage;
	});

	function invalidParams() {
		return page.status === 404 && !page.route.id && page.url.pathname !== "/";
	}

	const type = $derived.by(() => {
		if (invalidParams()) return "warning";
		return "error";
	});
</script>

<Layout data={page.data}>
	<div class="flex flex-1 flex-col items-center justify-center p-4">
		{#if !display}
			<div class="font-vecna mb-12 flex flex-col items-center text-3xl font-bold sm:text-5xl md:text-6xl">
				{#if page.status === 404}
					<img src="/images/d4.webp" alt="404" class="mb-2 size-50 max-lg:size-40 max-sm:size-30" />
					<h1>4D4: Not Found!</h1>
				{:else}
					<img src="/images/nat1.webp" alt="Error" class="mb-2 size-50 max-lg:size-40 max-sm:size-30" />
					<h1>Rolled a Natural 1!</h1>
				{/if}
			</div>
		{/if}
		<div class={twMerge("alert alert-error mb-4 flex w-full max-w-3xl gap-4 shadow-lg", type === "warning" && "alert-warning")}>
			<span class="iconify mdi--alert-circle max-xs:hidden size-6"></span>
			<div
				class={twMerge(
					"flex flex-1 gap-2",
					((page.error && page.error.message.length >= 150) || invalidParams()) && "max-md:flex-col"
				)}
			>
				<div class="flex flex-1 flex-col justify-center">
					<h3 class="font-bold">
						{#if invalidParams()}
							Don't panic!
						{:else}
							Error {page.status}!
						{/if}
					</h3>
					{#if invalidParams()}
						<div>
							Database IDs have been changed from CUIDs to UUIDs. This will break existing links to characters, but no data has
							been lost. You will still be able to access your characters using the new UUID going forward.
						</div>
					{:else}
						<div class="whitespace-pre-line">
							{page.error?.message || "Something went wrong"}
						</div>
					{/if}
				</div>
				{#if !display}
					<div class="flex items-center gap-2 max-sm:self-end">
						<button class="btn btn-sm max-sm:hidden" onclick={() => (display = true)}>View details</button>
					</div>
				{/if}
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
</Layout>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
