<script lang="ts">
	import { themeGroups, themes, type Themes } from "#lib/constants.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { createTransition } from "#lib/util.js";
	import { MediaQuery } from "svelte/reactivity";

	const global = getGlobal();
	const mq = new MediaQuery("(prefers-color-scheme: dark)");

	let open = $state(false);

	const current = $derived(themes.find((theme) => theme.value === global.app.settings.theme) ?? themes[0]);
	const systemTheme = $derived(themes.find((theme) => theme.value === "system"));
	const themesByGroup = $derived(
		themeGroups.map((group) => ({
			group,
			themes: themes.filter((theme) => "group" in theme && theme.group === group)
		}))
	);

	function portalDialog(node: HTMLDialogElement) {
		document.body.append(node);
		node.showModal();
		node.querySelector<HTMLButtonElement>("[aria-pressed='true']")?.focus();
		return () => {
			node.close();
			node.remove();
		};
	}

	function closeDialog(event: MouseEvent) {
		(event.currentTarget as HTMLElement).closest("dialog")?.close();
	}

	function applyTheme(value: Themes) {
		if (value === global.app.settings.theme) return;

		const selected = themes.find((theme) => theme.value === value);
		if (!selected) return;

		document.documentElement.classList.add("theme-switcher");
		createTransition(
			async () => {
				const theme = selected.value;
				const mode = theme === "system" ? (mq.current ? "dark" : "light") : "group" in selected ? selected.group : "dark";

				global.app.settings.theme = theme;
				if (theme === "system") {
					document.documentElement.removeAttribute("data-theme");
				} else {
					document.documentElement.dataset.theme = theme;
				}

				global.app.settings.mode = mode;
				const opposite = mode === "dark" ? "light" : "dark";
				document.documentElement.classList.replace(opposite, mode);
			},
			() => {
				document.documentElement.classList.remove("theme-switcher");
			},
			900
		);
	}
</script>

<button
	type="button"
	class="select-bordered select flex-1 cursor-pointer text-left leading-4 select-sm max-sm:text-base"
	aria-haspopup="dialog"
	aria-expanded={open}
	onclick={() => (open = true)}
>
	{current.name}
</button>

{#if open}
	<dialog
		class="modal bg-base-300/75!"
		aria-labelledby="theme-picker-title"
		{@attach portalDialog}
		onclose={() => (open = false)}
	>
		<div
			class="relative modal-box max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl cursor-default overflow-y-auto bg-base-100 drop-shadow-lg"
		>
			<button
				type="button"
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				onclick={closeDialog}
				aria-label="Close"
			>
				<span class="iconify mdi--close"></span>
			</button>
			<h3 id="theme-picker-title" class="mb-4 pr-8 text-lg font-bold text-base-content">Themes</h3>
			<div class="flex flex-col gap-6">
				{#if systemTheme}
					<div class="grid grid-cols-2 gap-x-4 gap-y-5 p-1 sm:grid-cols-3">
						{@render themeOption(systemTheme)}
					</div>
				{/if}
				{#each themesByGroup as { group, themes: groupThemes } (group)}
					<section class="flex flex-col gap-3" aria-labelledby="theme-group-{group}">
						<h4 id="theme-group-{group}" class="px-1 text-xs font-semibold tracking-wide text-base-content/60 uppercase">
							{group}
						</h4>
						<div class="grid grid-cols-2 gap-x-4 gap-y-5 p-1 sm:grid-cols-3">
							{#each groupThemes as theme (theme.value)}
								{@render themeOption(theme)}
							{/each}
						</div>
					</section>
				{/each}
			</div>
		</div>
		<button type="button" class="modal-backdrop" onclick={closeDialog} aria-label="Close">✕</button>
	</dialog>
{/if}

{#snippet themeOption(theme: (typeof themes)[number])}
	{@const selected = global.app.settings.theme === theme.value}
	{@const preview = theme.value === "system" ? (mq.current ? "black" : "light") : theme.value}
	<button type="button" class="group flex flex-col gap-2 rounded-lg text-left" aria-pressed={selected} onclick={() => applyTheme(theme.value)}>
		<span
			class={[
				"block rounded-xl ring-offset-2 ring-offset-base-100",
				selected ? "ring-2 ring-primary" : "group-hover:ring-2 group-hover:ring-base-content/30"
			]}
		>
			<span class="flex h-16 overflow-hidden rounded-lg border border-black/10" data-theme={preview}>
				<span class="flex w-[38%] flex-col gap-1.5 bg-base-300 p-2">
					<span class="h-1.5 w-4/5 rounded-full bg-base-content/35"></span>
					<span class="h-1.5 w-3/5 rounded-full bg-base-content/20"></span>
					<span class="mt-auto flex gap-1">
						<span class="size-2 rounded-full bg-primary"></span>
						<span class="size-2 rounded-full bg-secondary"></span>
					</span>
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-1.5 bg-base-100 p-2">
					<span class="h-1.5 w-4/5 rounded-full bg-base-content/25"></span>
					<span class="ml-auto h-1.5 w-2/5 rounded-full bg-base-content/15"></span>
					<span class="mt-auto h-3.5 rounded-full border border-base-content/25"></span>
				</span>
			</span>
		</span>
		<span class="px-0.5 text-sm text-base-content">{theme.name}</span>
	</button>
{/snippet}
