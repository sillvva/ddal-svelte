<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { signIn } from "@auth/sveltekit/client";
	import { onMount } from "svelte";

	export let data;

	onMount(() => {
		setTimeout(() => {
			const redirectTo = $page.url.searchParams.get("redirect") || "/characters";
			if (!$page.data.session?.user) {
				signIn(data.provider, { callbackUrl: `${$page.url.origin}${redirectTo}` });
			} else {
				goto(redirectTo, { replaceState: true });
			}
		}, 500);
	});
</script>

<main class="container relative mx-auto flex min-h-dvh flex-col items-center justify-center p-4">
	<h1>Signing in...</h1>
</main>
