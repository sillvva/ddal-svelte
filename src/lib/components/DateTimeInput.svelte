<script lang="ts">
	import type { HTMLTextareaAttributes } from "svelte/elements";

	interface $$Props extends HTMLTextareaAttributes {
		date?: Date | null;
	}

	export let date: Date | null = null;
	$: value = date ? new Date(date).toLocaleString("sv").substring(0, 16) : "";
</script>

<input
	{...$$restProps}
	type="datetime-local"
	{value}
	on:input={(ev) => {
		const value = ev.currentTarget.value;
		date = value ? new Date(value) : null;
	}}
/>
