<script lang="ts">
	import { page } from "$app/state";
	import { defaultDescription, defaultImage, defaultTitle } from "$lib/constants";

	interface Props {
		title?: string;
		description?: string;
		image?: string;
	}

	let { title = defaultTitle, description = defaultDescription, image = defaultImage }: Props = $props();
	const pTitle = $derived(title === defaultTitle ? defaultTitle : `${title.trim()} - ${defaultTitle}`);
</script>

<svelte:head>
	<title>{pTitle.trim()}</title>
	<meta name="title" content={pTitle.trim()} />
	<meta name="description" content={description.trim()} />
	<meta property="og:title" content={pTitle.trim()} />
	<meta property="og:site_name" content="Adventurers League Log Sheet" />
	<meta property="og:description" content={description.trim()} />
	<meta property="og:image" content={image.trim()} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:url" content={page.url.toString()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pTitle.trim()} />
	<meta name="twitter:description" content={description.trim()} />
	<meta name="twitter:image" content={image.trim()} />
	<meta name="twitter:url" content={page.url.toString()} />
	<link rel="canonical" href={page.url.toString()} />
</svelte:head>
