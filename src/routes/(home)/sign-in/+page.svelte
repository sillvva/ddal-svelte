<script lang="ts">
	import { page } from "$app/stores";
	import { signIn } from "@auth/sveltekit/client";
	import { onMount } from "svelte";

	onMount(() => {
		const redirectTo = $page.url.searchParams.get("redirect") || "/characters";
		if (!$page.data.session?.user) {
			signIn("google", {
				callbackUrl: `${$page.url.origin}${redirectTo}`
			});
		}
	});
</script>

<main class="container relative mx-auto flex min-h-screen flex-col items-center justify-center p-4">
	<h1>Signing in...</h1>
</main>
