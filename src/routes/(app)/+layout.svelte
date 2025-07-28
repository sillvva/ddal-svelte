<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { navigating, page } from "$app/state";
	import CommandTray from "$lib/components/CommandTray.svelte";
	import Drawer from "$lib/components/Drawer.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Settings from "$lib/components/Settings.svelte";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { hotkey } from "$lib/util";
	import { sleep } from "@svelteuidev/composables";
	import { fade } from "svelte/transition";

	let { data, children } = $props();

	const global = getGlobal();

	afterNavigate(() => {
		global.pageLoader = false;
	});

	async function closeModal() {
		do {
			history.back();
			await sleep(10);
		} while (page.state.modal);
	}

	$effect(() => {
		const hasCookie = document.cookie.includes("session-token");
		if (!data.user && hasCookie) location.reload();
	});
</script>

{#if global.pageLoader || navigating.type}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
		in:fade={{ duration: 100, delay: 400 }}
		out:fade={{ duration: 200 }}
	></div>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		in:fade={{ duration: 200, delay: 500 }}
		out:fade={{ duration: 200 }}
	>
		<span class="loading loading-spinner text-secondary w-16"></span>
	</div>
{/if}

<div class="relative isolate flex min-h-screen flex-col">
	<header
		class="border-base-300 bg-base-100 sticky top-0 z-20 w-full border-b transition-all"
		style:view-transition-name="header"
	>
		<nav class="relative z-10 container mx-auto flex max-w-5xl gap-2 p-4">
			<Drawer />
			<div class="inline max-w-10 shrink-0 flex-grow-1 sm:hidden">&nbsp;</div>
			<a
				href={data.user ? "/characters" : "/"}
				class="font-draconis flex min-w-fit flex-1 flex-col text-center sm:flex-none"
				aria-label="Home"
			>
				<h1 class="text-base-content text-base leading-4">Adventurers League</h1>
				<h2 class="text-3xl leading-7">Log Sheet</h2>
			</a>
			{#if data.user}
				<a href="/characters" class="ml-8 flex items-center p-2 max-md:hidden">Character Logs</a>
				<a href="/dm-logs" class="flex items-center p-2 max-md:hidden">DM Logs</a>
				<a href="/dms" class="flex items-center p-2 max-md:hidden">DMs</a>
				{#if data.user?.role === "admin"}
					<a href="/admin/users" class="flex items-center p-2 max-md:hidden">Admin</a>
				{/if}
			{/if}
			<div class="flex-1 max-sm:hidden">&nbsp;</div>
			<div class="flex items-center gap-4">
				{#if data.user}
					<CommandTray />
					<Settings />
				{:else}
					<a
						href={`/?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`}
						class="bg-base-200/50 text-base-content hover:bg-base-300 flex h-12 items-center gap-2 rounded-lg p-2 transition-colors"
					>
						<span class="flex h-full flex-1 items-center justify-center font-semibold">Sign In</span>
					</a>
				{/if}
			</div>
		</nav>
	</header>
	<div class="relative z-10 container mx-auto max-w-5xl flex-1 p-4">
		{@render children()}
	</div>
	<footer class="footer footer-center border-base-300 text-base-content relative z-16 border-t p-4 print:hidden">
		<div>
			<p>
				The name
				<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary"
					>Adventurers League</a
				>
				is property of Hasbro and
				<a href="https://dnd.wizards.com/" target="_blank" rel="noreferrer noopener" class="text-secondary"
					>Wizards of the Coast</a
				>. This website is affiliated with neither.
			</p>
		</div>
	</footer>
</div>

<dialog
	class="modal bg-base-300/75!"
	open={!!page.state.modal || undefined}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	{@attach hotkey([
		[
			"Escape",
			() => {
				if (page.state.modal) closeModal();
			}
		]
	])}
>
	{#if page.state.modal}
		{#if page.state.modal.type === "text"}
			<div
				class="modal-box bg-base-100 relative cursor-default drop-shadow-lg"
				style:max-width={page.state.modal.maxWidth}
				style:max-height={page.state.modal.maxHeight}
			>
				<button class="btn btn-circle btn-ghost btn-sm absolute top-2 right-2" onclick={closeModal} aria-label="Close">
					<span class="iconify mdi--close"></span>
				</button>
				<h3 id="modal-title" class="text-base-content cursor-text text-lg font-bold">{page.state.modal.name}</h3>
				{#if page.state.modal.date}
					<p class="text-xs">{page.state.modal.date.toLocaleString()}</p>
				{/if}
				<Markdown
					id="modal-content"
					content={page.state.modal.description}
					class="sm:text-md cursor-text pt-4 text-sm whitespace-pre-wrap"
				/>
			</div>
		{/if}

		{#if page.state.modal.type === "image"}
			<div class="glass modal-box">
				<img
					src={page.state.modal.imageUrl}
					alt={page.state.modal.name}
					class="relative max-h-dvh w-full max-w-(--breakpoint-xs)"
					id="modal-content"
				/>
			</div>
		{/if}

		<button class="modal-backdrop" onclick={closeModal} aria-label="Close">✕</button>
	{/if}
</dialog>
