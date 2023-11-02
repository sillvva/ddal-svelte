<script lang="ts">
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import { page } from "$app/stores";
	import { setCookie } from "$src/server/cookie";
	import { ModeWatcher, resetMode, setMode } from "mode-watcher";
	import { twMerge } from "tailwind-merge";
	import { hideBg, pageLoader } from "../store";

	export let open = false;
	let backdrop = false;
	let theme = $page.data.settings.theme;

	const toggleDrawer = (to: boolean) => {
		if (!to) {
			setTimeout(() => (backdrop = false), 150);
		} else {
			backdrop = true;
		}
	};

	const handleThemeChange = (value: string) => {
		theme = value;
		if (value === "light" || value === "dark") {
			setMode(value);
		} else {
			resetMode();
		}
	};

	$: toggleDrawer(open);
	$: setCookie("settings:theme", theme);
	$: browser && handleThemeChange(theme);
</script>

<ModeWatcher />
<ska:html data-theme={theme} />

<div
	id="settings"
	class={twMerge("fixed -right-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", open && "right-0")}
>
	<ul class="menu menu-lg w-full">
		<li>
			<label class="flex flex-row items-center gap-2 hover:bg-transparent">
				<span class="flex-1">Theme</span>
				<select class="select select-bordered select-sm" bind:value={theme}>
					<option value="system">System</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</label>
		</li>
		<li class="hidden rounded-lg lg:flex">
			<label class="flex flex-row items-center">
				<span class="flex-1 text-left">Background</span>
				<input
					type="checkbox"
					class="toggle"
					checked={!$hideBg}
					on:change={() => {
						$hideBg = !$hideBg;
					}}
				/>
			</label>
		</li>
		<form
			method="POST"
			action="/characters?/clearCaches"
			use:enhance={() => {
				$pageLoader = true;
				open = false;
				return async ({ update }) => {
					await update();
					$pageLoader = false;
				};
			}}
		>
			<li class="rounded-lg">
				<button class="h-full w-full">Clear Cache</button>
			</li>
		</form>
	</ul>
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full">
		<li class="md:hidden">
			<a href="https://github.com/sillvva/ddal-next13" target="_blank" rel="noreferrer noopener">Github</a>
		</li>
		<li>
			<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener">Contribute</a>
		</li>
	</ul>
</div>
<div
	class={twMerge(
		"fixed inset-0 bg-black/50 transition-all",
		backdrop ? "block" : "hidden",
		open ? "z-40 opacity-100" : "-z-10 opacity-0"
	)}
	on:keydown={() => (open = false)}
	on:click={() => (open = false)}
	role="none"
/>

<style>
	.menu-lg li {
		height: 3.5rem;
	}
	.menu-lg li * {
		line-height: 2rem;
	}
</style>
