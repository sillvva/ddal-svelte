<script lang="ts">
	import { highlighterConfig, highlighterThemeDark, highlighterThemeLight } from "$lib/constants";
	import { getGlobal } from "$lib/stores.svelte";
	import { createHighlighter } from "shiki";

	type Props = {
		title?: string;
		data: Record<string, unknown> | unknown[] | undefined;
	};

	let { title, data }: Props = $props();

	const global = getGlobal();

	let tooltip = $state("Copy to clipboard");

	const highlighter = await createHighlighter(highlighterConfig);
	const stringified = $derived(JSON.stringify(data ?? {}, null, 2));

	async function copyCode() {
		await navigator.clipboard.writeText(stringified);
		tooltip = "Copied!";
	}

	const highlighted = $derived(
		highlighter.codeToHtml(stringified, {
			lang: "json",
			theme: global.app.settings.mode === "dark" ? highlighterThemeDark : highlighterThemeLight
		})
	);
</script>

<div class="relative rounded-lg p-4 bg-slate-800">
	{#if data}
		<button
			type="button"
			class="absolute right-2 top-2 rounded aspect-square pt-2 tooltip tooltip-left bg-slate-700 px-2 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600"
			aria-label="Copy to clipboard"
			data-tip={tooltip}
			onclick={copyCode}
			onmouseleave={() => setTimeout(() => (tooltip = "Copy to clipboard"), 1000)}
		>
			<span class="iconify mdi--content-copy size-4"></span>
		</button>
	{/if}
	{#if title}
		<h3 class="mb-2 text-lg font-bold">{title}</h3>
	{/if}
	<div class="highlighted overflow-x-scroll">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html highlighted}
	</div>
</div>

<style>
	.highlighted :global(pre) {
		background-color: transparent !important;
		white-space: pre-wrap !important;
	}
</style>
