<script lang="ts">
	import { browser, dev } from "$app/environment";
	import { afterNavigate, onNavigate } from "$app/navigation";
	import { navigating, page } from "$app/stores";
	import { pageLoader } from "$lib/store";
	import { transition } from "$src/lib/utils";
	import { fade } from "svelte/transition";
	import { twMerge } from "tailwind-merge";
	import "../app.css";

	export let data;

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

{#if !data.mobile}
	<img
		src="/images/barovia-gate.webp"
		alt="Background"
		class="!fixed z-0 min-h-screen min-w-full object-cover object-center opacity-25 dark:opacity-20 print:hidden"
	/>
{/if}

<div class={twMerge("min-h-screen text-base-content", data.mobile && "bg-base-200 dark:[--b1:212_18%_16%]")}>
	<slot />
</div>

{#if $pageLoader || $navigating}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" in:fade out:fade={{ duration: 200 }} />
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		in:fade={{ duration: 200, delay: 200 }}
		out:fade={{ duration: 200 }}
	>
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}

{#if dev}
	<div class="fixed bottom-0 right-0 z-50">
		<div class="[&>*]:bg-lime-700 [&>*]:p-1 [&>*]:text-xs [&>*]:font-bold [&>*]:text-white">
			<div class="xs:hidden">xxs</div>
			<div class="hidden xs:block sm:hidden">xs</div>
			<div class="hidden sm:block md:hidden">sm</div>
			<div class="hidden md:block lg:hidden">md</div>
			<div class="hidden lg:block xl:hidden">lg</div>
			<div class="hidden xl:block 2xl:hidden">xl</div>
			<div class="hidden 2xl:block">2xl</div>
		</div>
	</div>
{/if}
