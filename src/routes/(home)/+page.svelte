<script lang="ts">
	import { browser } from "$app/environment";
	import { page } from "$app/stores";
	import { signIn } from "@auth/sveltekit/client";

	export let data;

	$: if (browser) {
		const hasCookie = document.cookie.includes("session-token");
		if (!$page.data.session?.user && hasCookie) location.reload();
	}

	const title = "Adventurers League Log Sheet";
	const description = "A tool for tracking your Adventurers League characters and magic items.";
	const image = "https://ddal.dekok.app/images/barovia-gate.webp";
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="title" content={title} />
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<main class="container relative mx-auto flex min-h-dvh flex-col items-center justify-center p-4">
	<h1 class="mb-20 text-center font-draconis text-4xl text-base-content dark:text-white lg:text-6xl">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<button
		class="flex h-16 items-center gap-4 rounded-lg bg-base-200/50 px-8 py-4 text-base-content transition-colors hover:bg-base-300"
		on:click={() =>
			signIn("google", {
				callbackUrl: `${$page.url.origin}${data.redirectTo || "/characters"}`
			})}
		aria-label="Sign in with Google"
	>
		<img src="/images/google.svg" width="32" height="32" alt="Google" />
		<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In</span>
	</button>
</main>
