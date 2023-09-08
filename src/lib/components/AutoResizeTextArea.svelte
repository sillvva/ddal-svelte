<script lang="ts">
	export let value: string | null = "";

	let el: HTMLTextAreaElement;
</script>

<textarea
	bind:this={el}
	bind:value
	{...$$restProps}
	style={`min-height: ${el?.scrollHeight + 10}px; height: auto; resize: none;`}
	spellcheck="true"
/>
