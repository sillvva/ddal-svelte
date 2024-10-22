<script lang="ts">
	import { themeGroups, themes, type Themes } from "$lib/constants";
	import { getApp } from "$lib/stores";
	import { createTransition, wait } from "$lib/util";
	import { browser } from "@svelteuidev/composables";

	const app = getApp();

	function switcher(node: HTMLSelectElement) {
		const controller = new AbortController();
		const signal = controller.signal;

		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener(
			"change",
			(ev) => {
				if ($app.settings.theme == "system") $app.settings.mode = ev.matches ? "dark" : "light";
			},
			{ signal }
		);

		node.addEventListener(
			"change",
			async () => {
				document.documentElement.dataset.switcher = "true";
				createTransition(() => {
					$app.settings.theme = node.value as Themes;
				});
				await wait(800);
				delete document.documentElement.dataset.switcher;
			},
			{ signal }
		);

		return {
			destroy() {
				controller.abort();
			}
		};
	}

	const selected = $derived(themes.find((t) => t.value === $app.settings.theme));
	$effect(() => {
		if (browser && selected) {
			if (selected.value === "system") {
				const mql = window.matchMedia("(prefers-color-scheme: dark)");
				$app.settings.mode = mql.matches ? "dark" : "light";
			} else {
				$app.settings.mode = selected.group;
			}
		}
	});
</script>

<select class="select select-bordered select-sm leading-4" use:switcher>
	<option value="system">System</option>
	{#each themeGroups as group}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme}
			<option value={theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
