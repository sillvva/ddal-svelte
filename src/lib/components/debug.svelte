<script lang="ts">
	import { highlighterConfig, highlighterThemeDark, highlighterThemeLight } from "#lib/constants.js";
	import { getGlobal } from "#lib/stores.svelte.js";
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

<div class="debug-container relative rounded-lg bg-slate-800 p-4">
	{#if data}
		<button
			type="button"
			class="copy-btn tooltip absolute tooltip-left top-2 right-2 aspect-square rounded bg-slate-700 px-2 py-1 pt-2 text-xs font-medium text-slate-100 hover:bg-slate-600"
			aria-label="Copy to clipboard"
			data-tip={tooltip}
			onclick={copyCode}
			onmouseleave={() => setTimeout(() => (tooltip = "Copy to clipboard"), 1000)}
		>
			<span class="iconify size-4 mdi--content-copy"></span>
		</button>
	{/if}
	{#if title}
		<div class="mb-2 text-lg font-bold">{title}</div>
	{/if}
	<div class="highlighted overflow-x-scroll">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html highlighted}
	</div>
</div>

<style>
	.debug-container {
		container-type: inline-size;
	}

	@container (max-width: 299px) {
		.copy-btn {
			display: none;
		}
	}

	.highlighted :global(pre) {
		background-color: transparent !important;
		white-space: pre-wrap !important;

		:global(.line > span) {
			white-space: pre;
		}
	}
</style>
