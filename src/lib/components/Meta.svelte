<script lang="ts">
	let defaultTitle = "Adventurers League Log Sheet";
	export let title = defaultTitle;
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	export let description = defaultDescription;
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.webp";
	export let image: string | null = defaultImage;
</script>

<svelte:head>
	<title>{title.trim() || defaultTitle}</title>
	<meta name="title" content={title.trim() || defaultTitle} />
	<meta name="description" content={description.trim() || defaultDescription} />
	<meta property="og:title" content={title.trim() || defaultTitle} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description.trim() || defaultDescription} />
	<meta property="og:image" content={image?.trim() || defaultImage} />
	<!-- <meta property="og:url" content={$page.url.href} /> -->
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:creator" content="@sillvvasensei" />
	<meta name="twitter:creator:id" content="1006748654391169029" />
	<meta name="twitter:title" content={title.trim() || defaultTitle} />
	<meta name="twitter:site" content="Adventurers League Log Sheet" />
	<meta name="twitter:description" content={description.trim() || defaultDescription} />
	<meta name="twitter:image" content={image?.trim() || defaultImage} />
</svelte:head>
