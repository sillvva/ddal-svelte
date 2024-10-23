<script lang="ts">
	import type { Writable } from "svelte/store";
	import { twMerge } from "tailwind-merge";

	interface Props {
		message: Writable<App.Superforms.Message | undefined>;
	}

	let { message }: Props = $props();
</script>

{#if $message}
	<div class={twMerge("alert mb-4 shadow-lg", $message.type === "error" ? "alert-error" : "alert-success")}>
		{#if $message.type === "success"}<span class="iconify size-6 mdi--check-circle"></span>{/if}
		{#if $message.type === "error"}<span class="iconify size-6 mdi--alert-circle"></span>{/if}
		{$message.text}
	</div>
{/if}
