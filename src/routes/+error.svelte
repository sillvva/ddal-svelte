<script lang="ts">
	import { dev } from "$app/environment";
	import { afterNavigate } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import AppAPI from "$lib/remote/app";
	import SuperDebug from "sveltekit-superforms";

	let previousPage = $state<string>(resolve("/"));
	let display = $state(!dev);

	const request = $derived(AppAPI.queries.request());
	const isMobile = $derived(request.current?.isMobile);
	const user = $derived(request.current?.user);

	afterNavigate(({ from }) => {
		previousPage = from?.url.pathname || previousPage;
	});
</script>

<div class="flex min-h-screen flex-col items-center justify-center">
	{#if !display}
		<h1 class="font-vecna mb-12 text-4xl font-bold">Rolled a Natural 1!</h1>
	{/if}
	<div class="alert alert-error mb-4 w-full max-w-3xl shadow-lg">
		<span class="iconify mdi--alert-circle size-6"></span>
		<div class="flex flex-col">
			<h3 class="font-bold">Error {page.status}!</h3>
			<div class="text-xs whitespace-pre-line">{page.error?.message || "Something went wrong"}</div>
		</div>
		{#if !display}
			<button class="btn btn-sm" onclick={() => (display = true)}>View details</button>
		{/if}
		<a href={previousPage} class="btn btn-sm">Go back</a>
	</div>
	{#if !display}
		<img src="/images/nat1.webp" alt="Error" class="size-80" />
	{/if}
	<SuperDebug
		{display}
		data={{
			...page,
			isMobile,
			user,
			data: undefined
		}}
	/>
</div>

<style>
	:global(.super-debug) {
		max-width: 100%;
	}
</style>
