<script lang="ts">
	import { stopWords } from "$lib/utils";

	export let text: string | string[] | null = "";
	export let search: string = "";
	export let filtered = false;
	export let separator = " | ";

	$: terms = getSearchTerms(search);
	$: regexes = getRegexesFromTerms(terms);
	$: regex = getJoinedRegexFromTerms(terms);
	$: items = getTextItems(text, filtered, regexes);
	$: match = getMatchedItems(items, regex);
	$: parts = getPartionedItems(items, match, regex);

	function getSearchTerms(search: string) {
		return (search.length > 1 ? search : "")
			.replace(new RegExp(` ?\\b(${[...stopWords].join("|")})\\b ?`, "gi"), " ")
			.replace(/([^ a-z0-9])/gi, "\\$1")
			.trim()
			.split(" ")
			.filter((i) => !!i);
	}

	function getRegexesFromTerms(terms: Array<string>) {
		return terms.map((term) => new RegExp(term, "gi"));
	}

	function getJoinedRegexFromTerms(terms: Array<string>) {
		return terms.length ? new RegExp(terms.join("|"), "gi") : null;
	}

	function getTextItems(text: string | string[] | null, filtered: boolean, regexes: Array<RegExp>) {
		return (Array.isArray(text) ? text : text?.split(separator) || [])
			.filter((item) => !filtered || regexes.every((regex) => item.match(regex)))
			.join(separator);
	}

	function getMatchedItems(items: string, regex: RegExp | null) {
		return regex && items.match(regex);
	}

	function getPartionedItems(items: string, match: RegExpMatchArray | null, regex: RegExp | null) {
		if (!match) return [];

		const splittedItems = regex ? items.split(regex) : [];

		for (let i = 1; i < splittedItems.length; i += 2) {
			splittedItems.splice(i, 0, match[(i - 1) / 2] || "");
		}

		return splittedItems;
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
