<script lang="ts">
	export let href = "";
	export let title: string | undefined;
	export let text: string | string[] = "";

	$: text = typeof text === "string" ? text.split(":") : text;
	let alt = text[0];
	let aspect = text.includes("no-aspect") ? "" : "aspect-video";
</script>

<figure class="flex flex-col mb-6 mt-6">
	<a
		{href}
		target="_blank"
		rel="noreferrer noopener"
		class="relative flex justify-center w-full max-w-[800px] mb-2 mx-auto {aspect}"
	>
		<img src={href} {title} {alt} class="object-cover md:object-contain" />
	</a>
	<figcaption class="block text-white/70 text-sm text-center">Click to open full screen</figcaption>
</figure>
