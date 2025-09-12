<script lang="ts">
	import { page } from "$app/state";
	import type { Crumb, ModuleData } from "$lib/util.js";
	import BackButton from "./BackButton.svelte";

	const routeModules: Record<string, ModuleData> = import.meta.glob("/src/routes/**/+page.svelte", {
		eager: true
	});

	export function titleSanitizer(title: string) {
		return title.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
	}

	function getPageTitleFromModule(module: ModuleData | undefined) {
		if (module?.pageTitle) return module.pageTitle;
		if (module?.getPageTitle) return module.getPageTitle(page.data);
		return undefined;
	}

	const crumbs = $derived.by(() => {
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
					title: getPageTitleFromModule(routeModule) || titleSanitizer(path)
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
