<script lang="ts">
	export let text: string | string[] | null = null;
	export let search: string = "";
	export let filtered = false;
	export let separator = " | ";

	$: regex = new RegExp(search, "gi");

	$: items = Array.isArray(text)
		? text.filter((item) => !filtered || item.match(regex)).join(separator)
		: text
				?.split(separator)
				.filter((item) => !filtered || item.match(regex))
				.join(separator);
	$: match = items?.match(regex);

	$: parts = items?.split(regex) || [];
	$: for (let i = 1; i < parts.length; i += 2) {
		parts.splice(i, 0, match?.[(i - 1) / 2] || "");
	}
</script>

{#if search.length}
	{#each parts as part}
		{#if regex.test(part)}
			<span class="bg-secondary px-1 text-black">{part}</span>
		{:else}
			{part}
		{/if}
	{/each}
{:else}
	{text}
{/if}
