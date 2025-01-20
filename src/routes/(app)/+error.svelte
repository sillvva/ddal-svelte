<script lang="ts">
	import { afterNavigate } from "$app/navigation";
	import { base } from "$app/paths";
	import { page } from "$app/state";
	import SuperDebug from "sveltekit-superforms";

	let previousPage = $state<string>(base || "/");

	afterNavigate(({ from }) => {
		previousPage = from?.url.pathname || previousPage;
	});
</script>

<div class="flex min-h-full flex-col items-center justify-center">
	<div class="alert alert-error mb-4 shadow-lg">
		<span class="iconify size-6 mdi--alert-circle"></span>
		<div>
			<h3 class="font-bold">Error {page.status}!</h3>
			<div class="text-xs">{page.error?.message || "Something went wrong"}</div>
		</div>
		<a href={previousPage} class="btn btn-sm">Go back</a>
	</div>
	<SuperDebug
		data={{
			...page,
			data: undefined,
			user: page.data.session?.user,
			mobile: page.data.mobile
		}}
	/>
</div>
