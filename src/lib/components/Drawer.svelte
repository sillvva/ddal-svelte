<script lang="ts">
	import { enhance } from "$app/forms";
	import { page } from "$app/stores";
	import { pageLoader, searchData } from "$src/routes/(app)/+layout.svelte";
	import { twMerge } from "tailwind-merge";

	let drawer = false;
	let backdrop = false;

	const toggleDrawer = (to: boolean) => {
		if (!to) {
			drawer = false;
			setTimeout(() => (backdrop = false), 150);
		} else {
			drawer = true;
			backdrop = true;
		}
	};
</script>

<button
	class="no-script-hide flex py-3 pr-4 md:hidden print:hidden"
	on:click={() => toggleDrawer(true)}
	aria-expanded={drawer}
	aria-controls="drawer"
>
	<span class="iconify mdi-[menu] size-6" />
</button>
<noscript>
	<span class="flex w-[52px] py-3 pr-4"> </span>
</noscript>
<div
	id="drawer"
	class={twMerge("fixed -left-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", drawer && "left-0")}
>
	<ul class="menu menu-lg w-full">
		<li>
			<a
				href="/characters"
				on:keydown={() => toggleDrawer(false)}
				on:click={() => toggleDrawer(false)}
				class={twMerge($page.url.pathname.startsWith("/characters") && "bg-primary text-white")}
			>
				Character Logs
			</a>
		</li>
		<li>
			<a
				href="/dm-logs"
				on:keydown={() => toggleDrawer(false)}
				on:click={() => toggleDrawer(false)}
				class={twMerge($page.url.pathname.startsWith("/dm-logs") && "bg-primary text-white")}
			>
				DM Logs
			</a>
		</li>
		<li>
			<a
				href="/dms"
				on:keydown={() => toggleDrawer(false)}
				on:click={() => toggleDrawer(false)}
				class={twMerge($page.url.pathname.startsWith("/dms") && "bg-primary text-white")}
			>
				DMs
			</a>
		</li>
	</ul>
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full">
		<form
			method="POST"
			action="/characters?/clearCaches"
			use:enhance={() => {
				$pageLoader = true;
				return async ({ update }) => {
					await update();
					toggleDrawer(false);
					$searchData = [];
					$pageLoader = false;
				};
			}}
		>
			<li>
				<button>Clear Cache</button>
			</li>
		</form>
	</ul>
	<div class="divider my-0" />
	<ul class="menu menu-lg w-full">
		<li>
			<a href="https://github.com/sillvva/ddal-svelte" target="_blank" rel="noreferrer noopener" class="items-center md:hidden">
				Github
			</a>
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
		drawer ? "z-40 opacity-100" : "-z-10 opacity-0"
	)}
	on:keydown={() => toggleDrawer(false)}
	on:click={() => toggleDrawer(false)}
	role="none"
/>
