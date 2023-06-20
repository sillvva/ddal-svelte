<script lang="ts">
	import SvelteMarkdown from "svelte-markdown";

	let className = "";
	export { className as class };

	export let content: string = "";

	// Renderers
	// import code from "$lib/components/renderers/code.svelte";
	import heading from "$lib/components/renderers/heading.svelte";
	import paragraph from "$lib/components/renderers/paragraph.svelte";
	// import codespan from "$lib/components/renderers/codespan.svelte";
	import image from "$lib/components/renderers/image.svelte";
	// import html from "$lib/components/renderers/html.svelte";
	import list from "$lib/components/renderers/list.svelte";
	import listitem from "$lib/components/renderers/listitem.svelte";
	import table from "$lib/components/renderers/table.svelte";
	import tablecell from "$lib/components/renderers/tablecell.svelte";
	import tablerow from "$lib/components/renderers/tablerow.svelte";

	const renderers = {
		// code,
		heading,
		paragraph,
		// codespan,
		image,
		// html,
		list,
		listitem,
		table,
		tablerow,
		tablecell
	};
</script>

<div class={className}>
	<SvelteMarkdown source={content} {renderers} />
</div>
