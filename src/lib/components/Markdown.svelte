<script lang="ts">
	import SvelteMarkdown from "svelte-markdown";
	// Renderers
	import blockquote from "$lib/components/renderers/blockquote.svelte";
	import heading from "$lib/components/renderers/heading.svelte";
	import image from "$lib/components/renderers/image.svelte";
	import link from "$lib/components/renderers/link.svelte";
	import list from "$lib/components/renderers/list.svelte";
	import listitem from "$lib/components/renderers/listitem.svelte";
	import paragraph from "$lib/components/renderers/paragraph.svelte";
	import table from "$lib/components/renderers/table.svelte";
	import tablecell from "$lib/components/renderers/tablecell.svelte";
	import tablerow from "$lib/components/renderers/tablerow.svelte";
	import type { HTMLAttributes } from "svelte/elements";

	export let content: string = "";

	interface $$Props extends HTMLAttributes<HTMLDivElement> {
		content: string;
	}
</script>

<div {...$$restProps}>
	<SvelteMarkdown
		source={content}
		renderers={{
			blockquote,
			heading,
			paragraph,
			image,
			link,
			list,
			listitem,
			table,
			tablerow,
			tablecell
		}}
	/>
</div>
