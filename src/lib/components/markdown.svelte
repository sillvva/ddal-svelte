<script lang="ts">
	import SvelteMarkdown from "@humanspeak/svelte-markdown";
	// Renderers
	import blockquote from "$lib/components/renderers/blockquote.svelte";
	import heading from "$lib/components/renderers/heading.svelte";
	import h1 from "$lib/components/renderers/html/h1.svelte";
	import h2 from "$lib/components/renderers/html/h2.svelte";
	import h3 from "$lib/components/renderers/html/h3.svelte";
	import h4 from "$lib/components/renderers/html/h4.svelte";
	import ol from "$lib/components/renderers/html/ol.svelte";
	import ul from "$lib/components/renderers/html/ul.svelte";
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
	import code from "./renderers/html/code.svelte";
	import details from "./renderers/html/details.svelte";
	import summary from "./renderers/html/summary.svelte";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		content?: string;
	}

	let { content = "", ...rest }: Props = $props();

	// Add newlines around HTML tags, but skip tags inside markdown table blocks
	function addNewlinesAroundTags(content: string) {
		// Split content into table and non-table segments
		const tableRegex = /((?:\|[^\n]*\|\s*(?:\n|$))+)/g;
		const tagRegex = /<([a-zA-Z]+)([^>]*)(\/?>)|<\/[a-zA-Z]+>/g;
		let lastIndex = 0;
		let result = "";
		let match: RegExpExecArray | null;

		while ((match = tableRegex.exec(content)) !== null) {
			// Process non-table segment before this table
			const nonTableSegment = content.slice(lastIndex, match.index);
			result += nonTableSegment.replace(tagRegex, "\n$&\n");
			// Add the table segment unchanged
			result += match[0];
			lastIndex = match.index + match[0].length;
		}
		// Process any remaining non-table content after the last table
		result += content.slice(lastIndex).replace(tagRegex, "\n$&\n");
		return result;
	}
</script>

<div {...rest}>
	<SvelteMarkdown
		source={addNewlinesAroundTags(content)}
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
			tablecell,
			html: {
				iframe: null,
				audio: null,
				video: null,
				embed: null,
				canvas: null,
				source: null,
				track: null,
				dialog: null,
				input: null,
				button: null,
				select: null,
				textarea: null,
				form: null,
				script: null,
				style: null,
				object: null,
				base: null,
				link: null,
				meta: null,
				table,
				thead: tablehead,
				tbody: tablebody,
				tr: tablerow,
				td: tablecell,
				p: paragraph,
				a: link,
				ol,
				ul,
				h1,
				h2,
				h3,
				h4,
				details,
				summary,
				code
			}
		}}
	/>
</div>
