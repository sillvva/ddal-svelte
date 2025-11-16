<script lang="ts">
	interface Props {
		text?: string | string[] | null;
		terms?: string[];
		filtered?: boolean;
		separator?: string;
		matches?: number;
	}

	let { text = "", terms = [], filtered = false, separator = " | ", matches = 1 }: Props = $props();

	const regexes = $derived(terms.map((term) => new RegExp(term, "gi")));
	const regex = $derived(terms.length ? new RegExp(terms.join("|"), "gi") : null);

	const items = $derived(Array.isArray(text) ? text : text?.split(separator) || []);
	const filteredItems = $derived(
		items.filter(
			(item) =>
				!filtered ||
				!terms.length ||
				(matches === 1 ? regexes.every((regex) => item.match(regex)) : regexes.some((regex) => item.match(regex)))
		)
	);

	const joinedItems = $derived((filteredItems.length ? filteredItems : items).join(separator));

	const match = $derived(regex && joinedItems.match(regex));

	const parts = $derived.by(() => {
		if (!match) return [];

		const splittedItems = regex ? joinedItems.split(regex) : [];

		for (let i = 1; i < splittedItems.length; i += 2) {
			splittedItems.splice(i, 0, match[(i - 1) / 2] || "");
		}

		return splittedItems;
	});
</script>

{#if parts.length && regex}
	{#each parts as part, i (i)}
		{#if regex.test(part)}
			<span class="bg-primary text-primary-content px-1 font-semibold">{part}</span>
		{:else}
			{part}
		{/if}
	{/each}
{:else}
	{items}
{/if}
