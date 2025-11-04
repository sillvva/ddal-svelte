<script lang="ts">
	import { themeGroups, themes } from "$lib/constants";
	import { getGlobal } from "$lib/stores.svelte";
	import { createTransition } from "$lib/util";
	import { MediaQuery } from "svelte/reactivity";

	const global = getGlobal();

	let theme = $state(global.app.settings.theme);
	const mq = new MediaQuery("(prefers-color-scheme: dark)");
	const mode = $derived.by(() => {
		const selected = themes.find((t) => t.value === theme);
		if (selected) {
			if (selected.value === "system") {
				return mq.current ? "dark" : "light";
			} else {
				return selected.group;
			}
		}
		return global.app.settings.mode;
	});

	$effect(() => {
		if (theme !== global.app.settings.theme || mode !== global.app.settings.mode) {
			document.documentElement.classList.add("theme-switcher");
			createTransition(
				() => {
					global.setApp((app) => {
						app.settings.theme = theme;
						app.settings.mode = mode;
					});
					const opposite = mode === "dark" ? "light" : "dark";
					document.documentElement.classList.replace(opposite, mode);
					if (theme === "system") {
						document.documentElement.removeAttribute("data-theme");
					} else {
						document.documentElement.dataset.theme = theme;
					}
				},
				() => {
					document.documentElement.classList.remove("theme-switcher");
				},
				900
			);
		}
	});
</script>

<select class="select select-bordered select-sm flex-1 leading-4" bind:value={theme}>
	<option value="system" selected={global.app.settings.theme === "system"}>System</option>
	{#each themeGroups as group (group)}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme (theme.value)}
			<option value={theme.value} selected={global.app.settings.theme === theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
