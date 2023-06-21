<script lang="ts">
	import { onMount } from "svelte";

	let defaultTitle = "Adventurers League Log Sheet";
	export let title = defaultTitle;
	let defaultDescription = "A tool for tracking your Adventurers League characters and magic items.";
	export let description = defaultDescription;
	let defaultImage = "https://ddal.dekok.app/images/barovia-gate.jpg";
	export let image: string | null = defaultImage;

	onMount(() => {
		return () => {
			// delete these tags on unmount to fix client-side issue where
			// svelte:head just keeps appending and doesn't hydrate existing meta tags
			// TODO: check if all metas need deleting or just these..
			document.head.querySelector("title")?.remove();
			document.head.querySelector('meta[property="og:title"]')?.remove();
			document.head.querySelector('meta[property="og:site_name"]')?.remove();
			document.head.querySelector('meta[property="og:description"]')?.remove();
			document.head.querySelector('meta[property="og:image"]')?.remove();
			document.head.querySelector('meta[property="og:type"]')?.remove();
			document.head.querySelector('meta[property="og:locale"]')?.remove();
			document.head.querySelector('meta[name="twitter:card"]')?.remove();
			document.head.querySelector('meta[name="twitter:creator"]')?.remove();
			document.head.querySelector('meta[name="twitter:creator:id"]')?.remove();
			document.head.querySelector('meta[name="twitter:site"]')?.remove();
			document.head.querySelector('meta[name="twitter:site:id"]')?.remove();
			document.head.querySelector('meta[name="twitter:description"]')?.remove();
			document.head.querySelector('meta[name="twitter:image"]')?.remove();
		};
	});
</script>

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
