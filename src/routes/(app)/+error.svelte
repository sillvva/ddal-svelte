<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { base } from "$app/paths";
	import { page } from "$app/stores";
	import Icon from "$lib/components/Icon.svelte";

	let previousPage: string = base || "/";

	afterNavigate(({ from }) => {
		previousPage = from?.url.pathname || previousPage;
	});
</script>

<div class="flex min-h-full flex-col items-center justify-center">
	<div class="alert alert-error shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		<div>
			<h3 class="font-bold">Error {$page.status}!</h3>
			<div class="text-xs">{$page.error?.message || "Something went wrong"}</div>
		</div>
		<a href={previousPage} class="btn-sm btn">Go back</a>
	</div>
	<!-- {#if $page.status !== 404} -->
	<pre class="mt-6 w-full overflow-x-auto bg-base-100 p-4 text-xs">{JSON.stringify($page, null, 2)}</pre>
	<!-- {/if} -->
</div>
