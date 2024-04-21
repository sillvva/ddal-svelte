<script lang="ts">
	import { themeGroups, themes } from "$lib/constants";
	import type { CookieStore } from "$server/cookie";
	import { browser } from "@svelteuidev/composables";
	import { getContext } from "svelte";

	const app = getContext<CookieStore<App.Cookie>>("app");

	function watchMedia(node: HTMLElement) {
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener("change", (ev) => {
			if ($app.settings.theme == "system") $app.settings.mode = ev.matches ? "dark" : "light";
		});
	}

	$: if (browser) {
		const selected = themes.find((t) => t.value === $app.settings.theme);
		if (selected) {
			if (selected.value === "system") {
				const mql = window.matchMedia("(prefers-color-scheme: dark)");
				$app.settings.mode = mql.matches ? "dark" : "light";
			} else {
				$app.settings.mode = selected.group;
			}
		}
	}
</script>

<select class="select select-bordered select-sm leading-4" bind:value={$app.settings.theme} use:watchMedia>
	<option value="system">System</option>
	{#each themeGroups as group}
		<hr />
		{#each themes.filter((t) => "group" in t && t.group === group) as theme}
			<option value={theme.value}>{theme.name}</option>
		{/each}
	{/each}
</select>
