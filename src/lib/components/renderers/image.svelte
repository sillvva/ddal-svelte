<script lang="ts">
	interface Props {
		href?: string;
		title?: string;
		text?: string | string[];
	}

	let { href = "", title, text = "" }: Props = $props();

	const dText = $derived(typeof text === "string" ? text.split(":") : text);
	const alt = $derived(dText[0]);
	const aspect = $derived(dText.includes("no-aspect") ? "" : "aspect-video");
</script>

<figure class="mb-6 mt-6 flex flex-col">
	<a
		{href}
		target="_blank"
		rel="noreferrer noopener"
		class="relative mx-auto mb-2 flex w-full max-w-[800px] justify-center {aspect}"
	>
		<img src={href} {title} {alt} class="object-cover md:object-contain" />
	</a>
	<figcaption class="block text-center text-sm text-white/70">Click to open full screen</figcaption>
</figure>
