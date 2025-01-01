<script lang="ts">
	import { themeGroups, themes } from "$lib/constants";
	import { global } from "$lib/stores.svelte";
	import { createTransition } from "$lib/util";
	import { MediaQuery } from "svelte/reactivity";

	let value = $state(global.app.settings.theme);
	$effect(() => {
		document.documentElement.dataset.switcher = value;
		createTransition(
			() => {
				global.app.settings.theme = value;
			},
			() => {
				delete document.documentElement.dataset.switcher;
			},
			800
		);
	});

	$effect(() => {
		const selected = themes.find((t) => t.value === value);
		if (selected) {
			if (selected.value === "system") {
				const mql = window.matchMedia("(prefers-color-scheme: dark)");
				global.app.settings.mode = mql.matches ? "dark" : "light";
			} else {
				global.app.settings.mode = selected.group;
			}
		}
	});

	const mq = new MediaQuery("(prefers-color-scheme: dark)");
	$effect.pre(() => {
		if (global.app.settings.theme == "system") global.app.settings.mode = mq.current ? "dark" : "light";
	});

	$effect.pre(() => {
		const mode = global.app.settings.mode;
		const theme = global.app.settings.theme;
		const current = theme === "system" && mode === "dark" ? "black" : theme;
		const opposite = mode === "dark" ? "light" : "dark";
		document.documentElement.classList.replace(opposite, mode);
		document.documentElement.dataset.theme = current;
	});
</script>

<select class="select select-bordered select-sm leading-4" bind:value>
	<option value="system" selected={global.app.settings.theme === "system"}>System</option>
	{#each themeGroups as group}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme}
			<option value={theme.value} selected={global.app.settings.theme === theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
