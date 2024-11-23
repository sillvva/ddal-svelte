<script lang="ts">
	import { excludedSearchWords } from "$lib/constants";

	interface Props {
		text?: string | string[] | null;
		search?: string | null;
		filtered?: boolean;
		separator?: string;
	}

	let { text = "", search = "", filtered = false, separator = " | " }: Props = $props();

	const terms = $derived(
		(search && search.length > 1 ? search : "")
			.replace(new RegExp(` ?\\b(${Array.from(excludedSearchWords).join("|")})\\b ?`, "gi"), " ")
			.replace(/([^ a-z0-9])/gi, "\\$1")
			.trim()
			.split(" ")
			.filter((i) => !!i)
	);

	const regexes = $derived(terms.map((term) => new RegExp(term, "gi")));
	const regex = $derived(terms.length ? new RegExp(terms.join("|"), "gi") : null);

	const items = $derived(
		(Array.isArray(text) ? text : text?.split(separator) || [])
			.filter((item) => !filtered || regexes.every((regex) => item.match(regex)))
			.join(separator)
	);

	const match = $derived(regex && items.match(regex));

	const parts = $derived.by(() => {
		if (!match) return [];

		const splittedItems = regex ? items.split(regex) : [];

		for (let i = 1; i < splittedItems.length; i += 2) {
			splittedItems.splice(i, 0, match[(i - 1) / 2] || "");
		}

		return splittedItems;
	});
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
