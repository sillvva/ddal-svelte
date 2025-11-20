<script lang="ts">
	import { afterNavigate, goto } from "$app/navigation";
	import { navigating, page } from "$app/state";
	import CommandTray from "$lib/components/command-tray.svelte";
	import Error from "$lib/components/error.svelte";
	import Footer from "$lib/components/footer.svelte";
	import Markdown from "$lib/components/markdown.svelte";
	import MobileNav from "$lib/components/mobile-nav.svelte";
	import Settings from "$lib/components/settings.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import * as API from "$lib/remote";
	import { getAuth, getGlobal } from "$lib/stores.svelte.js";
	import { hotkey, parseEffectResult } from "$lib/util";
	import { wait } from "@sillvva/utils";
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	let { children } = $props();

	const global = getGlobal();

	let settingsOpen = $state(false);
	let loadingImage = $state(true);

	const auth = $derived(await getAuth());

	afterNavigate(() => {
		global.pageLoader = false;
	});

	async function closeModal() {
		do {
			history.back();
			await wait(10);
		} while (page.state.modal);
	}

	onMount(() => {
		const hasCookie = document.cookie.includes("session-token");
		if (!auth.user && hasCookie) location.reload();
	});
</script>

{#if global.pageLoader || navigating.type}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
		in:fade={{ duration: 100, delay: 0 }}
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
		<nav class="relative z-10 container mx-auto flex max-w-5xl items-center gap-3 p-4">
			<div class="inline max-w-10 shrink-0 grow md:hidden">&nbsp;</div>
			<div class="inline max-w-10 shrink-0 grow md:hidden">&nbsp;</div>
			<a href={auth.user ? "/characters" : "/"} class="flex flex-1 items-center justify-center gap-1 md:flex-none">
				<img
					src="/images/{global.app.settings.mode === 'dark' ? 'dragon' : 'dragon-dark'}.webp"
					alt="Dragon"
					class="xs:block hidden size-10"
				/>
				<div class="font-draconis flex min-w-fit flex-col text-center">
					<h1 class="text-base-content text-base leading-4">Adventurers League</h1>
					<h2 class="text-3xl leading-7">Log Sheet</h2>
				</div>
			</a>
			{#if auth.user}
				<a href="/characters" class="ml-8 p-2 max-md:hidden">Character Logs</a>
				<a href="/dm-logs" class="p-2 max-md:hidden">DM Logs</a>
				<a href="/dms" class="p-2 max-md:hidden">DMs</a>
			{/if}
			<div class="flex-1 max-md:hidden"></div>
			<div class={["flex items-center", auth.user?.role === "admin" ? "gap-2" : "gap-4"]}>
				{#if auth.user}
					<CommandTray />

					{#if auth.user.role === "admin"}
						<a href="/admin/users" class="btn btn-ghost mr-1 p-2 max-md:hidden" aria-label="Admin">
							<span class="iconify mdi--administrator size-6"></span>
						</a>
					{/if}

					<!-- Avatar -->
					<div class="hidden items-center print:flex">
						{auth.user.name}
					</div>
					<div class="avatar flex h-full min-w-fit items-center">
						<button
							class="ring-primary ring-offset-base-100 relative h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-3 ring-offset-2 lg:h-11 lg:w-11"
							tabindex="0"
							onclick={() => (settingsOpen = true)}
						>
							<img
								src={auth.user.image || ""}
								alt={auth.user.name}
								class="rounded-full object-cover object-center"
								onerror={async (e) => {
									if (!auth.user) return;
									const img = e.currentTarget as HTMLImageElement;
									img.onerror = null;
									img.src = BLANK_CHARACTER;

									const result = await API.auth.actions.updateUser({ image: BLANK_CHARACTER });
									const parsed = await parseEffectResult(result);
									if (parsed) await auth.refresh();
								}}
							/>
						</button>
					</div>
				{:else}
					<a
						href={`/?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`}
						class="btn btn-ghost max-md:px-0"
					>
						<span class="iconify mdi--log-in size-6"></span>
						Sign In
					</a>
				{/if}
			</div>
		</nav>
	</header>
	<main class="relative z-10 container mx-auto flex max-w-5xl flex-1 flex-col gap-4 p-4 *:w-full">
		<svelte:boundary>
			{#snippet failed(error)}<Error {error} boundary="layout" />{/snippet}
			{@render children()}
		</svelte:boundary>
	</main>
	<Footer />
	<MobileNav />
	<Settings bind:open={settingsOpen} />
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
							<a
								class="text-secondary-content flex items-center gap-2"
								href={page.state.modal.goto}
								onclick={async (e) => {
									e.preventDefault();
									await closeModal();
									const { href } = e.target as HTMLAnchorElement;
									goto(href);
								}}
							>
								{page.state.modal.name}
								<span class="iconify mdi--magnify"></span>
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
				{#if loadingImage}
					<div class="flex h-40 flex-col items-center justify-center rounded-lg">
						<span class="loading loading-spinner text-secondary-content w-16"></span>
					</div>
				{/if}

				<img
					src={page.state.modal.imageUrl}
					alt={page.state.modal.name}
					class="relative max-h-dvh w-full max-w-(--breakpoint-xs)"
					id="modal-content"
					onloadstart={() => (loadingImage = true)}
					onload={() => (loadingImage = false)}
				/>
			</div>
		{/if}

		<button class="modal-backdrop" onclick={closeModal} aria-label="Close">✕</button>
	{/if}
</dialog>
