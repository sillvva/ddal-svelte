<script lang="ts">
	import type { Writable } from "svelte/store";
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";

	export let message: Writable<App.Superforms.Message | undefined>;
</script>

{#if $message}
	<div class={twMerge("alert mb-4 shadow-lg", $message.type === "error" ? "alert-error" : "alert-success")}>
		{#if $message.type === "success"}<Icon src="check-circle" class="w-6" />{/if}
		{#if $message.type === "error"}<Icon src="alert-circle" class="w-6" />{/if}
		{$message.text}
	</div>
{/if}
