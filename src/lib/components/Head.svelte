<script lang="ts">
	import { page } from "$app/state";
	import type { ModuleData } from "$lib/util";
	import { type Snippet } from "svelte";

	interface Props {
		children?: Snippet<
			[
				{
					title: string;
					description: string;
					image: string;
				}
			]
		>;
	}

	let { children }: Props = $props();

	const routeId = $derived(page.route.id || "/");
	const url = $derived(page.url);

	let routeModules = $state(
		import.meta.glob("/src/routes/**/+page.svelte", {
			eager: true
		}) as Record<string, ModuleData>
	);

	let defaultTitle = "Adventurers League Log Sheet";
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";

	function titleSanitizer(title: string) {
		return title.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
	}

	function getPageTitleFromModule(module: ModuleData | undefined) {
		const paths = url.pathname.split("/").filter(Boolean);
		const path = paths.at(-1);
		const title = (
			module?.headTitle ||
			module?.getHeadData?.(page.data)?.title ||
			module?.pageTitle ||
			module?.getPageTitle?.(page.data) ||
			titleSanitizer(path || "")
		).trim();

		return title ? `${title} - ${defaultTitle}` : defaultTitle;
	}

	function getPageDescriptionFromModule(module: ModuleData | undefined) {
		return (module?.headDescription || module?.getHeadData?.(page.data)?.description || defaultDescription).trim();
	}

	function getPageImageFromModule(module: ModuleData | undefined) {
		const image = module?.headImage || module?.getHeadData?.(page.data)?.image || defaultImage;
		if (image.startsWith("/")) return `${url.origin}${image}`;
		return image;
	}

	const headerData = $derived.by(() => {
		const modules = $state.snapshot(routeModules) as Record<string, ModuleData>;
		const routeModule = modules?.[`/src/routes${routeId}/+page.svelte`];

		return {
			title: getPageTitleFromModule(routeModule),
			description: getPageDescriptionFromModule(routeModule),
			image: getPageImageFromModule(routeModule)
		};
	});
</script>

{@render children?.(headerData)}
