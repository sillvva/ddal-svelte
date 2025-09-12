<script lang="ts">
	import type { Writable } from "svelte/store";

	interface Props {
		message: Writable<App.Superforms.Message | undefined>;
	}

	let { message }: Props = $props();
</script>

{#if $message}
	<div class="alert data-[type=success]:alert-success data-[type=error]:alert-error shadow-lg" data-type={$message.type}>
		{#if $message.type === "success"}<span class="iconify mdi--check-circle size-6"></span>{/if}
		{#if $message.type === "error"}<span class="iconify mdi--alert-circle size-6"></span>{/if}
		{$message.text}
	</div>
{/if}
