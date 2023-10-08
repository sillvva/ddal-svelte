<script lang="ts">
	export let value: Date | null = null;
	$: date = value ? new Date(value).toLocaleString("sv").substring(0, 16) : "";
</script>

<input
	type="datetime-local"
	value={date}
	{...$$restProps}
	on:input={(ev) => {
		const date = ev.currentTarget.value;
		value = date ? new Date(date) : null;
	}}
/>
