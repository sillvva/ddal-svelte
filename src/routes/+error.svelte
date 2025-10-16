<script lang="ts">
	import { dev } from "$app/environment";
	import { page } from "$app/state";
	import { uuidV7 } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte";
	import { useOs } from "@svelteuidev/composables";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";
	import * as v from "valibot";
	import Layout from "./(app)/+layout.svelte";

	let display = $state(!dev);

	const global = getGlobal();
	const os = useOs();

	const appRoutes = Object.keys(import.meta.glob("/src/routes/**/+page.svelte"))
		.map((key) => key.replace(/\/src\/routes\/|\(\w+\)|\/?\+page\.svelte/g, ""))
		.filter(Boolean)
		.map((key) => key.split("/"));

	function invalidParams() {
		if (page.status !== 404 || page.route.id) return false;

		const paths = page.url.pathname.split("/");
		const globs = appRoutes.filter((g) => g.length === paths.length);

		for (const p in paths) {
			if (!p) continue;
			if (!globs.find((g) => g[p]?.match(/^\[/))) continue;
			const result = v.safeParse(uuidV7, paths[p]);
			if (!result.success) return true;
		}

		return false;
	}
</script>

<Layout>
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
		<div class={["alert mb-4 flex w-full max-w-3xl gap-4 shadow-lg", invalidParams() ? "alert-warning" : "alert-error"]}>
			<span class="iconify mdi--alert-circle max-xs:hidden size-6"></span>
			<div
				class={["flex flex-1 gap-2", ((page.error && page.error.message.length >= 150) || invalidParams()) && "max-md:flex-col"]}
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
			<SuperDebugRuned
				data={{
					...page,
					os: os,
					user: global.user,
					data: undefined
				}}
			/>
		{/if}
	</div>
</Layout>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
