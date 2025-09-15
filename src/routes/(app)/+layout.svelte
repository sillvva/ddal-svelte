<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { navigating, page } from "$app/state";
	import CommandTray from "$lib/components/CommandTray.svelte";
	import Footer from "$lib/components/Footer.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import MobileNav from "$lib/components/MobileNav.svelte";
	import Settings from "$lib/components/Settings.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import { parseEffectResult } from "$lib/factories.svelte";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { hotkey } from "$lib/util";
	import { sleep } from "@svelteuidev/composables";
	import { fade } from "svelte/transition";

	let { data, children } = $props();

	const global = getGlobal();

	let settingsOpen = $state(false);

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
		<span class="loading loading-spinner text-secondary-content w-16"></span>
	</div>
{/if}

<div class="relative flex min-h-dvh flex-col">
	<header
		class="border-base-300 bg-base-100/50 sticky top-0 z-20 w-full border-b backdrop-blur-sm transition-all"
		style:view-transition-name="header"
	>
		<nav class="relative z-10 container mx-auto flex max-w-5xl gap-3 p-4">
			<div class="inline max-w-10 shrink-0 flex-grow-1 md:hidden">&nbsp;</div>
			<div class="inline max-w-10 shrink-0 flex-grow-1 md:hidden">&nbsp;</div>
			<a
				href={data.user ? "/characters" : "/"}
				class="font-draconis flex min-w-fit flex-1 flex-col text-center md:flex-none"
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
			<div class="flex-1 max-md:hidden">&nbsp;</div>
			<div class="flex items-center gap-4">
				{#if data.user}
					<CommandTray />

					<!-- Avatar -->
					<div class="hidden items-center print:flex">
						{data.user.name}
					</div>
					<div class="avatar flex h-full min-w-fit items-center">
						<button
							class="ring-primary ring-offset-base-100 relative h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-3 ring-offset-2 lg:h-11 lg:w-11"
							tabindex="0"
							onclick={() => (settingsOpen = true)}
						>
							<img
								src={data.user.image || ""}
								alt={data.user.name}
								class="rounded-full object-cover object-center"
								onerror={async (e) => {
									if (!data.user) return;
									const img = e.currentTarget as HTMLImageElement;
									img.onerror = null;
									img.src = BLANK_CHARACTER;

									const result = await API.auth.actions.updateUser({ image: BLANK_CHARACTER });
									const parsed = await parseEffectResult(result);
									if (parsed) await API.app.queries.request().refresh();
								}}
							/>
						</button>
					</div>
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
	<main class="relative z-10 container mx-auto flex max-w-5xl flex-1 p-4 *:w-full">
		{@render children()}
	</main>
	<Footer />
	<MobileNav />
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
				<div class="flex flex-col gap-2">
					<h3 id="modal-title" class="text-base-content cursor-text text-lg font-bold">
						{#if page.state.modal.goto}
							<a class="text-secondary-content flex items-center gap-2" href={page.state.modal.goto} onclick={closeModal}>
								{page.state.modal.name}
								<span class="iconify mdi--link"></span>
							</a>
						{:else}
							{page.state.modal.name}
						{/if}
					</h3>
					{#if page.state.modal.date}
						<p class="text-xs">{page.state.modal.date.toLocaleString()}</p>
					{/if}
					<Markdown
						id="modal-content"
						content={page.state.modal.description}
						class="sm:text-md cursor-text text-sm whitespace-pre-wrap"
					/>
				</div>
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

<svelte:boundary>
	{#snippet pending()}{/snippet}

	<Settings bind:open={settingsOpen} />
</svelte:boundary>
