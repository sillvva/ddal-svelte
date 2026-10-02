<script lang="ts">
	import { themeGroups, themes, type Themes } from "#lib/constants.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { createTransition } from "#lib/util.js";
	import { MediaQuery } from "svelte/reactivity";

	const global = getGlobal();
	const mq = new MediaQuery("(prefers-color-scheme: dark)");
</script>

<select
	class="select select-bordered select-sm flex-1 leading-4 max-sm:text-base"
	value={global.app.settings.theme}
	onchange={(ev) => {
		document.documentElement.classList.add("theme-switcher");
		createTransition(
			async () => {
				const value = (ev.target as HTMLSelectElement).value as Themes;
				const selected = themes.find((t) => t.value === value);

				if (selected) {
					const theme = selected.value;
					const mode = selected.value === "system" ? (mq.current ? "dark" : "light") : selected.group;

					global.app.settings.theme = theme;
					if (theme === "system") {
						document.documentElement.removeAttribute("data-theme");
					} else {
						document.documentElement.dataset.theme = theme;
					}

					global.app.settings.mode = mode;
					const opposite = mode === "dark" ? "light" : "dark";
					document.documentElement.classList.replace(opposite, mode);
				}
			},
			() => {
				document.documentElement.classList.remove("theme-switcher");
			},
			900
		);
	}}
>
	<option value="system" selected={global.app.settings.theme === "system"}>System</option>
	{#each themeGroups as group (group)}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme (theme.value)}
			<option value={theme.value} selected={global.app.settings.theme === theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
