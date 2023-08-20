<script lang="ts">
	export let value: Date | null = null;
	let date = value ? new Date(value).toLocaleString("sv").substring(0, 16) : null;
</script>

<input
	type="datetime-local"
	bind:value={date}
	{...$$restProps}
	on:input={() => {
		value = date ? new Date(date) : null;
	}}
/>
