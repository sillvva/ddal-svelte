<script lang="ts">
	import { page } from "$app/stores";
	import Icon from "$lib/components/Icon.svelte";

	let code = $page.url.searchParams.get("code");
	if (!code || code === "undefined") code = "500";

	const message = $page.url.searchParams.get("message") || "Something went wrong";
</script>

<div class="flex min-h-screen flex-col items-center justify-center">
	<div class="alert alert-error max-w-3xl shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		<div>
			<h3 class="font-bold">Error {code}!</h3>
			<div class="text-xs">{message || "Something went wrong"}</div>
		</div>
		<a href="/" class="btn btn-sm">Go back</a>
	</div>
</div>
