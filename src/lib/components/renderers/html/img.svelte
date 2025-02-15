<script lang="ts">
	interface Props {
		attributes?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	}

	const { attributes }: Props = $props();
	const id = $props.id();
</script>

<figure class="mt-6 mb-6 flex flex-col">
	<a
		href={attributes?.src}
		target="_blank"
		rel="noreferrer noopener"
		class="relative mx-auto mb-2 flex aspect-video w-full max-w-[800px] justify-center"
		aria-labelledby={id}
	>
		<img {...attributes} {id} class="object-cover md:object-contain" />
	</a>
	<figcaption class="block text-center text-sm text-white/70">Click to open full screen</figcaption>
</figure>
