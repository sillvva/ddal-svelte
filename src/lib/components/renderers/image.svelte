<script lang="ts">
	interface Props {
		href?: string;
		title?: string;
		text?: string | string[];
	}

	let { href = "", title, text = "" }: Props = $props();
	const id = $props.id();

	const dText = $derived(typeof text === "string" ? text.split(":") : text);
	const alt = $derived(dText[0]);
</script>

<a
	{href}
	target="_blank"
	rel="noreferrer noopener"
	class="md-image relative mb-2 flex max-h-100 justify-start"
	aria-labelledby={id}
>
	<img src={href} {title} {alt} {id} class="max-h-100 object-cover md:object-contain" />
</a>
