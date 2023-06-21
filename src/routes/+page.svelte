<script lang="ts">
	import { page } from "$app/stores";
	import Meta from "$lib/components/Meta.svelte";
	import { signIn } from "@auth/sveltekit/client";
</script>

<svelte:head>
	<Meta />
</svelte:head>

<main class="container relative mx-auto flex min-h-screen flex-col items-center justify-center p-4">
	<h1 class="mb-20 text-center font-draconis text-4xl text-base-content dark:text-white lg:text-6xl">
		Adventurers League
		<br />
		Log Sheet
	</h1>
	<button
		class="items-centers flex h-16 gap-4 rounded-lg bg-base-200/50 px-8 py-4 text-base-content transition-colors hover:bg-base-300"
		on:click={() =>
			signIn("google", {
				callbackUrl: `${$page.url.origin}/characters`
			})}
	>
		<img src="/images/google.svg" width="32" height="32" alt="Google" />
		<span class="flex h-full flex-1 items-center justify-center text-xl font-semibold">Sign In</span>
	</button>
</main>
