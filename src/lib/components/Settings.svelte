<script lang="ts">
	import { browser } from "$app/environment";
	import { enhance } from "$app/forms";
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import { twMerge } from "tailwind-merge";
	import { app, pageLoader } from "../store";

	export let open = false;
	let backdrop = false;

	onMount(() => {
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		mql.addEventListener("change", (ev) => {
			if ($app.settings.theme == "system") $app.settings.mode = ev.matches ? "dark" : "light";
		});
	});

	$: if (browser) {
		if ($app.settings.theme === "system") {
			const mql = window.matchMedia("(prefers-color-scheme: dark)");
			$app.settings.mode = mql.matches ? "dark" : "light";
		} else {
			$app.settings.mode = $app.settings.theme;
		}
	}

	$: if (browser) {
		if (!open) {
			setTimeout(() => (backdrop = false), 150);
		} else {
			backdrop = true;
		}
	}
</script>

<ska:html data-theme={$app.settings.theme} class={$app.settings.mode} />

<div
	id="settings"
	class={twMerge("fixed -right-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", open && "right-0")}
>
	<ul class="menu menu-lg w-full">
		<li>
			<label class="flex flex-row items-center gap-2 hover:bg-transparent">
				<span class="flex-1">Theme</span>
				<select class="select select-bordered select-sm" bind:value={$app.settings.theme}>
					<option value="system">System</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</label>
		</li>
		{#if !$page.data.mobile}
			<li class="hidden rounded-lg lg:flex">
				<label class="flex flex-row items-center">
					<span class="flex-1 text-left">Background</span>
					<input type="checkbox" class="toggle" bind:checked={$app.settings.background} />
				</label>
			</li>
		{/if}
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
