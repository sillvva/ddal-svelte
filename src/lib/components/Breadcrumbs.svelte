<script lang="ts">
	import { page } from "$app/state";
	import { routeModules, type Crumb, type ModuleData } from "$lib/modules";
	import BackButton from "./BackButton.svelte";

	export function titleSanitizer(title: string) {
		return title.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
	}

	async function getPageTitleFromModule(module: ModuleData | undefined) {
		if (module?.pageTitle) return module.pageTitle;
		if (module?.getPageTitle) return await module.getPageTitle(page.params);
		return undefined;
	}

	const temp = $derived.by(async () => {
		let tmpCrumbs = [] as Crumb[];
		if (page.route.id) {
			let completeUrl = "";
			let completeRoute = "/src/routes";

			const routes = page.route.id.split(/(?<!\))\//).filter((p) => p != "");
			const paths = page.url.pathname.split("/").filter((p) => p != "");

			for (let i = 0; i < paths.length; i++) {
				let path = paths[i];
				let route = routes[i];
				if (!path || !route) continue;

				completeUrl += `/${path}`;
				completeRoute += `/${route}`;

				const routeModule = routeModules[`${completeRoute}/+page.svelte`];
				if (!routeModule) continue;

				tmpCrumbs.push({
					url: completeUrl,
					title: (await getPageTitleFromModule(routeModule)) || titleSanitizer(path)
				});
			}
		} else {
			let completeUrl = "";
			const paths = page.url.pathname.split("/").filter((p) => p != "");
			for (let i = 0; i < paths.length; i++) {
				let path = paths[i];
				if (!path) continue;

				completeUrl += `/${path}`;
				tmpCrumbs.push({
					title: titleSanitizer(path),
					url: completeUrl
				});
			}
		}
		return tmpCrumbs;
	});
	const crumbs = $derived(await temp);
</script>

<div class={["flex min-h-9 flex-1 items-center max-sm:min-h-8 sm:mb-4", crumbs.length === 1 && "max-sm:hidden"]}>
	{#if crumbs.length > 0}
		{@const back = crumbs.at(-2)}
		{#if back?.url && crumbs.length > 1}
			<div class="flex-1 sm:hidden">
				<BackButton href={back.url}>{back.title}</BackButton>
			</div>
		{/if}
		<div class="breadcrumbs flex-1 text-sm max-sm:hidden print:hidden">
			<ul class="h-5">
				<li>
					<span class="iconify mdi--home size-4"></span>
				</li>
				{#each crumbs as bc, i (i)}
					{#if bc.url && bc.title && !["/characters/new"].includes(bc.url)}
						{#if bc.url !== crumbs.at(-1)?.url}
							<li>
								<a href={bc.url} class="text-secondary-content">
									{bc.title}
								</a>
							</li>
						{:else}
							<li class="ellipsis-nowrap dark:drop-shadow-md">
								{bc.title}
							</li>
						{/if}
					{/if}
				{/each}
			</ul>
		</div>
	{/if}
</div>
