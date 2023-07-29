<script lang="ts">
	import { stopWords } from "$lib/utils";
	import type { SearchResult } from "minisearch";

	export let text: string | string[] | null = "";
	export let search: string = "";
	export let filtered = false;
	export let separator = " | ";
	export let msResult: SearchResult | null | undefined = null;

	$: term = (search.length > 1 ? search : "")
		.replace(new RegExp(` ?\\b(${[...stopWords].join("|")})\\b ?`, "gi"), " ")
		.replace(/([^ a-z0-9])/gi, "\\$1")
		.trim();
	$: regexes = term
		.split(" ")
		.filter(Boolean)
		.map((word) => new RegExp(word, "gi"));
	$: regex = term ? new RegExp(term.replace(/ /gi, "|"), "gi") : null;

	$: items1 = Array.isArray(text)
		? text.filter((item) => !filtered || regexes.every((regex) => item.match(regex)))
		: text?.split(separator).filter((item) => !filtered || regexes.every((regex) => item.match(regex))) || [];
	$: items =
		msResult && !items1.length
			? (Array.isArray(text)
					? text.filter((item) => !filtered || !regex || item.match(regex))
					: text?.split(separator).filter((item) => !filtered || !regex || item.match(regex)) || []
			  ).join(separator)
			: items1.join(separator);
	$: match = regex ? items.match(regex) : [];
	$: parts = (regex && items.split(regex)) || [];
	$: for (let i = 1; i < parts.length; i += 2) {
		parts.splice(i, 0, match?.[(i - 1) / 2] || "");
	}
</script>

{#if parts.length && regex}
	{#each parts as part}
		{#if regex.test(part)}
			<span class="bg-secondary px-1 text-black">{part}</span>
		{:else}
			{part}
		{/if}
	{/each}
{:else}
	{items}
{/if}
