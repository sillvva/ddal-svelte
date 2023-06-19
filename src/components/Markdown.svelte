<script lang="ts">
	import SvelteMarkdown from "svelte-markdown";

	let className = "";
	export { className as class };

	export let content: string = "";

	// Renderers
	// import code from "$components/renderers/code.svelte";
	import heading from "$components/renderers/heading.svelte";
	import paragraph from "$components/renderers/paragraph.svelte";
	// import codespan from "$components/renderers/codespan.svelte";
	import image from "$components/renderers/image.svelte";
	// import html from "$components/renderers/html.svelte";
	import list from "$components/renderers/list.svelte";
	import listitem from "$components/renderers/listitem.svelte";
	import table from "$components/renderers/table.svelte";
	import tablerow from "$components/renderers/tablerow.svelte";
	import tablecell from "$components/renderers/tablecell.svelte";

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
