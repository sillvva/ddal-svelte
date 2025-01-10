<script lang="ts">
	import { themeGroups, themes } from "$lib/constants";
	import { global } from "$lib/stores.svelte";
	import { createTransition } from "$lib/util";
	import { MediaQuery } from "svelte/reactivity";

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
			document.documentElement.dataset.switcher = theme;
			createTransition(
				() => {
					global.app.settings.theme = theme;
					global.app.settings.mode = mode;
					const current = theme === "system" && mode === "dark" ? "black" : theme;
					const opposite = mode === "dark" ? "light" : "dark";
					document.documentElement.classList.replace(opposite, mode);
					document.documentElement.dataset.theme = current;
				},
				() => {
					delete document.documentElement.dataset.switcher;
				},
				800
			);
		}
	});
</script>

<select class="select select-bordered select-sm leading-4" bind:value={theme}>
	<option value="system" selected={global.app.settings.theme === "system"}>System</option>
	{#each themeGroups as group}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme}
			<option value={theme.value} selected={global.app.settings.theme === theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
