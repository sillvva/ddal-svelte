<script lang="ts">
	import SvelteMarkdown from "@humanspeak/svelte-markdown";
	// Renderers
	import blockquote from "$lib/components/renderers/blockquote.svelte";
	import heading from "$lib/components/renderers/heading.svelte";
	import image from "$lib/components/renderers/image.svelte";
	import link from "$lib/components/renderers/link.svelte";
	import list from "$lib/components/renderers/list.svelte";
	import listitem from "$lib/components/renderers/listitem.svelte";
	import paragraph from "$lib/components/renderers/paragraph.svelte";
	import table from "$lib/components/renderers/table.svelte";
	import tablebody from "$lib/components/renderers/tablebody.svelte";
	import tablecell from "$lib/components/renderers/tablecell.svelte";
	import tablehead from "$lib/components/renderers/tablehead.svelte";
	import tablerow from "$lib/components/renderers/tablerow.svelte";
	import type { HTMLAttributes } from "svelte/elements";

	type Props = HTMLAttributes<HTMLDivElement> & {
		content?: string;
	};

	let { content = "", ...rest }: Props = $props();
</script>

<div {...rest}>
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
			tablehead,
			tablebody,
			tablerow,
			tablecell
		}}
	/>
</div>
