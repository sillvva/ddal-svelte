<script lang="ts">
	import { page } from "$app/state";
	import { routeModules } from "$lib/module";
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

	const defaultTitle = "Adventurers League Log Sheet";
	const defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	const defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";

	function titleSanitizer(title: string) {
		return title.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
	}

	function getPageTitleFromModule(module: App.ModuleData | undefined) {
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

	function getPageDescriptionFromModule(module: App.ModuleData | undefined) {
		return (module?.headDescription || module?.getHeadData?.(page.data)?.description || defaultDescription).trim();
	}

	function getPageImageFromModule(module: App.ModuleData | undefined) {
		const image = module?.headImage || module?.getHeadData?.(page.data)?.image || defaultImage;
		if (image.startsWith("/")) return `${url.origin}${image}`;
		return image;
	}

	const headerData = $derived.by(() => {
		const routeModule = routeModules[`/src/routes${routeId}/+page.svelte`];

		return {
			title: getPageTitleFromModule(routeModule),
			description: getPageDescriptionFromModule(routeModule),
			image: getPageImageFromModule(routeModule)
		};
	});
</script>

{@render children?.(headerData)}
