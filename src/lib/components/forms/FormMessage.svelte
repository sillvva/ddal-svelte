<script lang="ts">
	import type { Writable } from "svelte/store";

	interface Props {
		message: Writable<App.Superforms.Message | undefined>;
	}

	let { message }: Props = $props();
</script>

{#if $message}
	<div class="alert mb-4 shadow-lg data-[type=success]:alert-success data-[type=error]:alert-error" data-type={$message.type}>
		{#if $message.type === "success"}<span class="iconify size-6 mdi--check-circle"></span>{/if}
		{#if $message.type === "error"}<span class="iconify size-6 mdi--alert-circle"></span>{/if}
		{$message.text}
	</div>
{/if}
