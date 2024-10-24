<script lang="ts">
	import { themeGroups, themes, type Themes } from "$lib/constants";
	import { global } from "$lib/stores.svelte";
	import { createTransition, wait } from "$lib/util";

	function switcher(node: HTMLSelectElement) {
		const controller = new AbortController();
		const signal = controller.signal;

		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener(
			"change",
			(ev) => {
				if (global.app.settings.theme == "system") global.app.settings.mode = ev.matches ? "dark" : "light";
			},
			{ signal }
		);

		node.addEventListener(
			"change",
			async () => {
				document.documentElement.dataset.switcher = "true";
				createTransition(() => {
					global.app.settings.theme = node.value as Themes;
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

	$effect.pre(() => {
		const mode = global.app.settings.mode;
		const theme = global.app.settings.theme;
		const current = theme === "system" && mode === "dark" ? "black" : theme;
		const opposite = mode === "dark" ? "light" : "dark";
		document.documentElement.classList.replace(opposite, mode);
		document.documentElement.dataset.theme = current;
	});

	const selected = $derived(themes.find((t) => t.value === global.app.settings.theme));
	$effect(() => {
		if (selected) {
			if (selected.value === "system") {
				const mql = window.matchMedia("(prefers-color-scheme: dark)");
				global.app.settings.mode = mql.matches ? "dark" : "light";
			} else {
				global.app.settings.mode = selected.group;
			}
		}
	});
</script>

<select class="select select-bordered select-sm leading-4" use:switcher>
	<option value="system" selected={global.app.settings.theme === "system"}>System</option>
	{#each themeGroups as group}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme}
			<option value={theme.value} selected={global.app.settings.theme === theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
