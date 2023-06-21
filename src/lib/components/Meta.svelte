<script lang="ts">
	let defaultTitle = "Adventurers League Log Sheet";
	export let title = defaultTitle;
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	export let description = defaultDescription;
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.jpg";
	export let image: string | null = defaultImage;

	// onMount(() => {
	// 	return () => {
	// 		// delete these tags on unmount to fix client-side issue where
	// 		// svelte:head just keeps appending and doesn't hydrate existing meta tags
	// 		// TODO: check if all metas need deleting or just these..
	// 		document.head.querySelectorAll("title, meta[itemscope]").forEach((e) => e.remove());
	// 	};
	// });
</script>

<svelte:head>
	<title>{title.trim() || defaultTitle}</title>
	<meta itemscope name="title" content={title.trim() || defaultTitle} />
	<meta itemscope name="description" content={description.trim() || defaultDescription} />
	<meta itemscope property="og:title" content={title.trim() || defaultTitle} />
	<meta itemscope property="og:site_name" content="Adventurers League Log Sheet" />
	<meta itemscope property="og:description" content={description.trim() || defaultDescription} />
	<meta itemscope property="og:image" content={image?.trim() || defaultImage} />
	<!-- <meta property="og:url" content={$page.url.href} /> -->
	<meta itemscope property="og:type" content="website" />
	<meta itemscope property="og:locale" content="en_US" />
	<meta itemscope name="twitter:card" content="summary_large_image" />
	<meta itemscope name="twitter:creator" content="@sillvvasensei" />
	<meta itemscope name="twitter:creator:id" content="1006748654391169029" />
	<meta itemscope name="twitter:title" content={title.trim() || defaultTitle} />
	<meta itemscope name="twitter:site" content="Adventurers League Log Sheet" />
	<meta itemscope name="twitter:description" content={description.trim() || defaultDescription} />
	<meta itemscope name="twitter:image" content={image?.trim() || defaultImage} />
</svelte:head>
