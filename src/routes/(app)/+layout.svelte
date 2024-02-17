<script lang="ts" context="module">
	import { writable } from "svelte/store";
	export const pageLoader = writable(false);
</script>

<script lang="ts">
	import { browser } from "$app/environment";
	import { afterNavigate } from "$app/navigation";
	import { navigating, page } from "$app/stores";
	import Drawer from "$lib/components/Drawer.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Settings from "$lib/components/Settings.svelte";
	import type { CookieStore } from "$src/server/cookie.js";
	import { signOut } from "@auth/sveltekit/client";
	import { hotkey } from "@svelteuidev/composables";
	import { getContext } from "svelte";
	import { fade } from "svelte/transition";
	import { twMerge } from "tailwind-merge";

	export let data;
	const app = getContext<CookieStore<App.Cookie>>("app");

	let settingsOpen = false;
	let y = 0;

	afterNavigate(() => {
		pageLoader.set(false);
	});

	$: if (browser) {
		const hasCookie = document.cookie.includes("session-token");
		if (!$page.data.session?.user && hasCookie) location.reload();
	}

	let defaultTitle = "Adventurers League Log Sheet";
	$: title = $page.data.title ? $page.data.title + " - " + defaultTitle : defaultTitle;
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	$: description = $page.data.description || defaultDescription;
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";
	$: image = $page.data.image || defaultImage;
</script>

<svelte:head>
	<title>{title.trim() || defaultTitle}</title>
	<meta name="title" content={title.trim() || defaultTitle} />
	<meta name="description" content={description.trim() || defaultDescription} />
	<meta property="og:title" content={title.trim() || defaultTitle} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description.trim() || defaultDescription} />
	<meta property="og:image" content={image?.trim() || defaultImage} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title.trim() || defaultTitle} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description.trim() || defaultDescription} />
	<meta name="twitter:image" content={image?.trim() || defaultImage} />
</svelte:head>

<svelte:window bind:scrollY={y} />

{#if $pageLoader || $navigating}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
		in:fade={{ duration: 100, delay: 400 }}
		out:fade={{ duration: 200 }}
	/>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		in:fade={{ duration: 200, delay: 500 }}
		out:fade={{ duration: 200 }}
	>
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}

<div class="relative flex min-h-screen flex-col">
	<header
		class={twMerge(
			"static -top-16 z-20 w-full border-b-[1px] border-slate-500 transition-all",
			(data.mobile || !$app.settings.background) && "sticky top-0 border-base-300 bg-base-100",
			!data.mobile && $app.settings.background && y >= 4 * 16 && "sticky top-0 border-slate-500/50"
		)}
	>
		{#if $app.settings.background && !data.mobile}
			<div class={twMerge("absolute inset-0 transition-all", y >= 4 * 16 && "backdrop-blur-lg")} />
		{/if}
		<nav class="container relative z-10 mx-auto flex max-w-5xl gap-2 p-4">
			<Drawer />
			<Settings bind:open={settingsOpen} />
			<a
				href={data.session?.user ? "/characters" : "/"}
				class={twMerge(
					"mr-8 flex flex-col text-center font-draconis",
					(data.mobile || !$app.settings.background) && "mr-2 flex-1 sm:flex-none md:mr-8"
				)}
			>
				<h1 class="text-base leading-4 text-black dark:text-white">Adventurers League</h1>
				<h2 class="text-3xl leading-7">Log Sheet</h2>
			</a>
			{#if data.session?.user}
				<a href="/characters" class="hidden items-center p-2 md:flex">Character Logs</a>
				<a href="/dm-logs" class="hidden items-center p-2 md:flex">DM Logs</a>
				<a href="/dms" class="hidden items-center p-2 md:flex">DMs</a>
			{/if}
			<div class={twMerge("flex-1", (data.mobile || !$app.settings.background) && "hidden sm:block")}>&nbsp;</div>
			<a
				href="https://github.com/sillvva/ddal-svelte"
				target="_blank"
				rel="noreferrer noopener"
				class="hidden items-center p-2 lg:flex"
			>
				<Icon src="github" class="w-6" />
			</a>
			{#if data.session?.user}
				<Dropdown class="dropdown-end">
					<summary tabindex="0" class="flex h-full cursor-pointer items-center pl-4">
						<div class="hidden items-center pr-4 text-black dark:text-white sm:flex print:flex">
							{data.session?.user?.name}
						</div>
						<div class="avatar">
							<div
								class={twMerge(
									"relative w-11 overflow-hidden rounded-full ring ring-primary ring-offset-2 ring-offset-base-100",
									(data.mobile || !$app.settings.background) && "w-9 lg:w-11"
								)}
							>
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
					<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
						<li class="sm:hidden">
							<span>{data.session?.user?.name}</span>
						</li>
						<li class="no-script-hide">
							<button on:click={() => (settingsOpen = true)} aria-controls="settings">Settings</button>
						</li>
						<li>
							<a href="#top" on:click={() => signOut({ callbackUrl: "/" })}>Logout</a>
						</li>
					</ul>
				</Dropdown>
			{:else}
				<a
					href={`/?redirect=${encodeURIComponent(`${$page.url.pathname}${$page.url.search}`)}`}
					class="flex h-12 items-center gap-2 rounded-lg bg-base-200/50 p-2 text-base-content transition-colors hover:bg-base-300"
				>
					<span class="flex h-full flex-1 items-center justify-center font-semibold">Sign In</span>
				</a>
			{/if}
		</nav>
	</header>
	<div class="container relative z-10 mx-auto max-w-5xl flex-1 p-4"><slot /></div>
	<footer class="z-16 footer footer-center relative bg-base-300/50 p-4 text-base-content print:hidden">
		<div>
			<p>
				All
				<a
					href="https://www.dndbeyond.com/sources/cos/the-lands-of-barovia#BGatesofBarovia"
					target="_blank"
					rel="noreferrer noopener"
					class="text-secondary"
				>
					images
				</a>
				and the name
				<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary">
					Adventurers League
				</a>
				are property of Hasbro and
				<a href="https://dnd.wizards.com/" target="_blank" rel="noreferrer noopener" class="text-secondary">
					Wizards of the Coast
				</a>. This website is affiliated with neither.
			</p>
		</div>
	</footer>
</div>

<dialog
	class={twMerge("modal !bg-base-200/50")}
	open={!!$page.state.modal || undefined}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	use:hotkey={[
		[
			"Escape",
			() => {
				if ($page.state.modal) history.back();
			}
		]
	]}
>
	{#if $page.state.modal}
		{#if $page.state.modal.type === "text"}
			<div class="modal-box relative cursor-default bg-base-300 drop-shadow-lg">
				<button class="btn btn-circle btn-ghost btn-sm absolute right-2 top-2" on:click={() => history.back()}>✕</button>
				<h3 id="modal-title" class="cursor-text text-lg font-bold text-black dark:text-white">{$page.state.modal.name}</h3>
				{#if $page.state.modal.date}
					<p class="text-xs">{$page.state.modal.date.toLocaleString()}</p>
				{/if}
				<Markdown
					id="modal-content"
					content={$page.state.modal.description}
					class="sm:text-md cursor-text whitespace-pre-wrap pt-4 text-sm"
				/>
			</div>
		{/if}

		{#if $page.state.modal.type === "image"}
			<div class="glass modal-box">
				<img
					src={$page.state.modal.imageUrl}
					alt={$page.state.modal.name}
					class="relative max-h-dvh w-full max-w-screen-xs"
					id="modal-content"
				/>
			</div>
		{/if}

		<button class="modal-backdrop" on:click={() => history.back()}>✕</button>
	{/if}
</dialog>
