<script lang="ts">
	import { browser } from "$app/environment";
	import { afterNavigate, onNavigate, pushState } from "$app/navigation";
	import { navigating, page } from "$app/stores";
	import Drawer from "$lib/components/Drawer.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Settings from "$lib/components/Settings.svelte";
	import { pageLoader } from "$lib/store";
	import Markdown from "$src/lib/components/Markdown.svelte";
	import type { AppStore } from "$src/lib/types/schemas";
	import { transition } from "$src/lib/utils.js";
	import { signIn, signOut } from "@auth/sveltekit/client";
	import { getContext } from "svelte";
	import { fade } from "svelte/transition";
	import { twMerge } from "tailwind-merge";

	export let data;
	const app = getContext<AppStore>("app");

	let settingsOpen = false;

	afterNavigate(() => {
		pageLoader.set(false);
	});

	onNavigate((navigation) => {
		return new Promise((resolve) => {
			transition(async () => {
				resolve();
				await navigation.complete;
			});
		});
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
			"relative z-20 w-full border-b-[1px] border-slate-500",
			(data.mobile || !$app.settings.background) && "sticky top-0 border-slate-300 bg-base-300 dark:border-slate-700"
		)}
	>
		<nav class="container mx-auto flex max-w-5xl gap-2 p-4">
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
				<div class="dropdown dropdown-end">
					<div role="button" tabindex="0" class="flex h-full cursor-pointer items-center pl-4">
						<div class="hidden items-center pr-4 text-black dark:text-white print:flex sm:flex">
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
					</div>
					<ul class="menu dropdown-content w-52 rounded-box bg-base-100 p-2 shadow">
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
				</div>
			{:else}
				<button
					class="flex h-12 items-center gap-2 rounded-lg bg-base-200/50 p-2 text-base-content transition-colors hover:bg-base-300"
					on:click={() => signIn("google", { callbackUrl: `${$page.url.origin}${$page.url.pathname}${$page.url.search}` })}
				>
					<img src="/images/google.svg" width="24" height="24" alt="Google" />
					<span class="flex h-full flex-1 items-center justify-center font-semibold">Sign In</span>
				</button>
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
				<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary">
					Wizards of the Coast
				</a>. This website is affiliated with neither.
			</p>
		</div>
	</footer>
</div>

<div
	role="presentation"
	class={twMerge("modal cursor-pointer !bg-black/50", $page.state.modal && "modal-open")}
	on:click={() => pushState("", { modal: null })}
	on:keypress={() => null}
>
	{#if $page.state.modal}
		<div
			role="presentation"
			class="modal-box relative cursor-default drop-shadow-lg"
			on:click={(e) => e.stopPropagation()}
			on:keypress={() => null}
		>
			<h3 class="cursor-text text-lg font-bold text-black dark:text-white">{$page.state.modal.name}</h3>
			{#if $page.state.modal.date}
				<p class="text-xs">{$page.state.modal.date.toLocaleString()}</p>
			{/if}
			<Markdown content={$page.state.modal.description} class="sm:text-md cursor-text whitespace-pre-wrap pt-4 text-sm" />
		</div>
	{/if}
</div>
