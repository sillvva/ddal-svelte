<script lang="ts">
	import type { Writable } from "svelte/store";
	import { twMerge } from "tailwind-merge";

	export let message: Writable<App.Superforms.Message | undefined>;
</script>

{#if $message}
	<div class={twMerge("alert mb-4 shadow-lg", $message.type === "error" ? "alert-error" : "alert-success")}>
		{#if $message.type === "success"}<span class="iconify size-6 mdi--check-circle" />{/if}
		{#if $message.type === "error"}<span class="iconify size-6 mdi--alert-circle" />{/if}
		{$message.text}
	</div>
{/if}
