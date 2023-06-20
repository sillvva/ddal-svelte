<script lang="ts">
	export let text: string | null = null;
	export let search: string = "";

	$: regex = new RegExp(search, "gi");
	$: match = text?.match(regex);

	$: parts = text?.split(regex) || [];
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
