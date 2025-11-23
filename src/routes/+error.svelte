<script lang="ts">
	import { browser, dev } from "$app/environment";
	import { page } from "$app/state";
	import { logClientError } from "$lib/remote/admin/actions.remote";
	import { uuidV7 } from "$lib/schemas";
	import { getAuth } from "$lib/stores.svelte";
	import { useOs } from "@svelteuidev/composables";
	import SuperDebugRuned from "sveltekit-superforms/SuperDebug.svelte";
	import * as v from "valibot";
	import Layout from "./(app)/+layout.svelte";

	let display = $state(!dev);

	const os = useOs();

	$effect(() => {
		if (!page.error) return;

		console.error(page.error.message);
		if (browser) {
			logClientError({
				message: page.error.message,
				status: page.status,
				boundary: "+error.svelte"
			});
		}
	});

	const appRoutes = Object.keys(import.meta.glob("/src/routes/**/+page.svelte"))
		.map((key) => key.replace(/\/src\/routes\/|\(\w+\)|\/?\+page\.svelte/g, ""))
		.filter(Boolean)
		.map((key) => key.split("/"));

	function invalidParams() {
		if (page.status !== 404 || page.route.id) return false;

		const paths = page.url.pathname.split("/");
		const globs = appRoutes.filter((g) => g.length === paths.length);

		outer: for (let g = 1; g < globs.length; g++) {
			const glob = globs[g]!;
			inner: for (let p = 1; p < paths.length; p++) {
				const path = paths[p]!;
				const route = glob[p];

				if (route === path) continue inner;
				else if (!route?.match(/^\[/)) continue outer;

				if (route?.match(/^\[/)) {
					const result = v.safeParse(uuidV7, path);
					if (!result.success) return true;
				}
			}
		}

		return false;
	}
</script>

<Layout>
	<div class="flex flex-1 flex-col items-center justify-center p-4">
		{#if !display}
			<div class="font-vecna mb-12 flex flex-col items-center text-3xl font-bold sm:text-5xl md:text-6xl">
				<img src="/images/confused-goblin.webp" alt="Error" class="mb-2 size-80 max-lg:size-65 max-sm:size-50" />
				{#if page.status === 404}
					<h1>4D4: Not Found!</h1>
				{:else}
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
			{@const auth = await getAuth()}
			<SuperDebugRuned
				data={{
					...page,
					os: os,
					user: auth.user,
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
