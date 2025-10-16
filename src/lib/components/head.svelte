<script lang="ts">
	import { page } from "$app/state";
	import { defaultDescription, defaultImage, defaultTitle } from "$lib/constants";
	import type { ModuleData } from "$lib/types";

	const routeModules: Record<string, ModuleData> = import.meta.glob("/src/routes/**/+page.svelte", {
		eager: true
	});

	async function getHeadFromModule(module: ModuleData | undefined) {
		if (module?.pageHead) return module.pageHead;
		if (module?.getPageHead) return await module.getPageHead(page.params);
		return undefined;
	}

	const pageHead = $derived(await getHeadFromModule(routeModules[`/src/routes${page.route.id}/+page.svelte`]));
	const pageTitle = $derived(
		!pageHead?.title || pageHead?.title === defaultTitle ? defaultTitle : `${pageHead?.title?.trim()} - ${defaultTitle}`
	);
	const pageDescription = $derived(pageHead?.description || defaultDescription);
	const pageImage = $derived(pageHead?.image || defaultImage);
</script>

<svelte:head>
	<title>{pageTitle.trim()}</title>
	<meta name="title" content={pageTitle.trim()} />
	<meta name="description" content={pageDescription.trim()} />
	<meta property="og:title" content={pageTitle.trim()} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={pageDescription.trim()} />
	<meta property="og:image" content={pageImage.trim()} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={page.url.toString()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle.trim()} />
	<meta name="twitter:description" content={pageDescription.trim()} />
	<meta name="twitter:image" content={pageImage.trim()} />
	<meta name="twitter:url" content={page.url.toString()} />
	<link rel="canonical" href={page.url.toString()} />
</svelte:head>
