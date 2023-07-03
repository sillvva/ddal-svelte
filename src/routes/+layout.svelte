<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { navigating, page } from "$app/stores";
	import { pageLoader } from "$src/lib/store";
	import { fade } from "svelte/transition";
	import "../app.css";

	afterNavigate(() => {
		pageLoader.set(false);
	});

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
	<!-- <meta property="og:url" content={$page.url.href} /> -->
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

<svelte:body class="min-h-screen text-base-content" />

<img
	src="/images/barovia-gate.webp"
	alt="Background"
	class="!fixed z-0 min-h-screen min-w-full object-cover object-center opacity-40 dark:opacity-20 print:hidden"
/>

<slot />

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
