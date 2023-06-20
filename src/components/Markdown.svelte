<script lang="ts">
	import SvelteMarkdown from "svelte-markdown";

	let className = "";
	export { className as class };

	export let content: string = "";

	// Renderers
	// import code from "$src/components/renderers/code.svelte";
	import heading from "$src/components/renderers/heading.svelte";
	import paragraph from "$src/components/renderers/paragraph.svelte";
	// import codespan from "$src/components/renderers/codespan.svelte";
	import image from "$src/components/renderers/image.svelte";
	// import html from "$src/components/renderers/html.svelte";
	import list from "$src/components/renderers/list.svelte";
	import listitem from "$src/components/renderers/listitem.svelte";
	import table from "$src/components/renderers/table.svelte";
	import tablecell from "$src/components/renderers/tablecell.svelte";
	import tablerow from "$src/components/renderers/tablerow.svelte";

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
