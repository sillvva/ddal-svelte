<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { navigating, page } from "$app/state";
	import CommandTray from "$lib/components/CommandTray.svelte";
	import Drawer from "$lib/components/Drawer.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Settings from "$lib/components/Settings.svelte";
	import { global } from "$lib/stores.svelte.js";
	import { hotkey } from "@svelteuidev/composables";
	import { Toaster } from "svelte-sonner";
	import { fade } from "svelte/transition";

	let { data, children } = $props();

	let settingsOpen = $state(false);

	afterNavigate(() => {
		global.pageLoader = false;
	});

	$effect(() => {
		const hasCookie = document.cookie.includes("session-token");
		if (!data.session?.user && hasCookie) location.reload();
	});

	let defaultTitle = "Adventurers League Log Sheet";
	const title = $derived(page.data.title ? page.data.title + " - " + defaultTitle : defaultTitle);
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	const description = $derived(page.data.description || defaultDescription);
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";
	const image = $derived(page.data.image || defaultImage);
</script>

<svelte:head>
	<title>{title.trim()}</title>
	<meta name="title" content={title.trim()} />
	<meta name="description" content={description.trim()} />
	<meta property="og:title" content={title.trim()} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description.trim()} />
	<meta property="og:image" content={image.trim()} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={page.url.toString()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title.trim()} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description.trim()} />
	<meta name="twitter:image" content={image.trim()} />
	<link rel="canonical" href={page.url.toString()} />
</svelte:head>

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
		<span class="loading loading-spinner w-16 text-secondary"></span>
	</div>
{/if}

<div class="relative isolate flex min-h-screen flex-col">
	<header
		class="sticky top-0 z-20 w-full border-b border-base-300 bg-base-100 transition-all"
		style:view-transition-name="header"
	>
		<nav class="container relative z-10 mx-auto flex max-w-5xl gap-2 p-4">
			<Drawer />
			<Settings bind:open={settingsOpen} />
			<div class="inline max-w-10 shrink-0 flex-grow-[1] sm:hidden">&nbsp;</div>
			<a
				href={data.session?.user ? "/characters" : "/"}
				class="flex min-w-fit flex-1 flex-col text-center font-draconis sm:flex-none"
				aria-label="Home"
			>
				<h1 class="text-base leading-4 text-black dark:text-white">Adventurers League</h1>
				<h2 class="text-3xl leading-7">Log Sheet</h2>
			</a>
			{#if data.session?.user}
				<a href="/characters" class="ml-8 hidden items-center p-2 md:flex">Character Logs</a>
				<a href="/dm-logs" class="hidden items-center p-2 md:flex">DM Logs</a>
				<a href="/dms" class="hidden items-center p-2 md:flex">DMs</a>
			{/if}
			<div class="flex-1 max-sm:hidden">&nbsp;</div>
			<div class="flex gap-4">
				<CommandTray isMac={data.isMac} />
				<div class="hidden items-center print:flex">
					{data.user?.name}
				</div>
				{#if data.session?.user}
					<summary tabindex="0" class="flex h-full min-w-fit cursor-pointer items-center" onclick={() => (settingsOpen = true)}>
						<div class="avatar">
							<div class="relative w-9 overflow-hidden rounded-full ring ring-primary ring-offset-2 ring-offset-base-100 lg:w-11">
								<img
									src={data.session?.user?.image || ""}
									alt={data.session?.user?.name}
									width={48}
									height={48}
									class="rounded-full object-cover object-center"
								/>
							</div>
						</div>
					</summary>
				{:else}
					<a
						href={`/?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`}
						class="flex h-12 items-center gap-2 rounded-lg bg-base-200/50 p-2 text-base-content transition-colors hover:bg-base-300"
					>
						<span class="flex h-full flex-1 items-center justify-center font-semibold">Sign In</span>
					</a>
				{/if}
			</div>
		</nav>
	</header>
	<div class="container relative z-10 mx-auto max-w-5xl flex-1 p-4">
		{@render children()}
	</div>
	<footer class="z-16 footer footer-center relative border-t border-base-300 p-4 text-base-content print:hidden">
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

<Toaster richColors closeButton theme={global.app.settings.mode} />

<dialog
	class="modal !bg-base-300/75"
	open={!!page.state.modal || undefined}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	use:hotkey={[
		[
			"Escape",
			() => {
				if (page.state.modal) history.back();
			}
		]
	]}
>
	{#if page.state.modal}
		{#if page.state.modal.type === "text"}
			<div class="modal-box relative cursor-default bg-base-100 drop-shadow-lg">
				<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" onclick={() => history.back()} aria-label="Close">
					<span class="iconify mdi--close"></span>
				</button>
				<h3 id="modal-title" class="cursor-text text-lg font-bold text-black dark:text-white">{page.state.modal.name}</h3>
				{#if page.state.modal.date}
					<p class="text-xs">{page.state.modal.date.toLocaleString()}</p>
				{/if}
				<Markdown
					id="modal-content"
					content={page.state.modal.description}
					class="sm:text-md cursor-text whitespace-pre-wrap pt-4 text-sm"
				/>
			</div>
		{/if}

		{#if page.state.modal.type === "image"}
			<div class="glass modal-box">
				<img
					src={page.state.modal.imageUrl}
					alt={page.state.modal.name}
					class="relative max-h-dvh w-full max-w-screen-xs"
					id="modal-content"
				/>
			</div>
		{/if}

		<button class="modal-backdrop" onclick={() => history.back()} aria-label="Close">✕</button>
	{/if}
</dialog>
