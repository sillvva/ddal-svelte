<script lang="ts">
	import { twMerge } from "tailwind-merge";
	import Icon from "./Icon.svelte";

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

<button class="flex py-3 pr-4 print:hidden md:hidden" on:click={() => toggleDrawer(true)}>
	<Icon src="menu" class="w-6" />
</button>
<div class={twMerge("fixed -left-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", drawer && "left-0")}>
	<ul class="menu w-full">
		<li>
			<a href="/characters" on:keydown={() => toggleDrawer(false)} on:click={() => toggleDrawer(false)}>Character Logs</a>
		</li>
		<li>
			<a href="/dm-logs" on:keydown={() => toggleDrawer(false)} on:click={() => toggleDrawer(false)}>DM Logs</a>
		</li>
		<li>
			<a href="/dms" on:keydown={() => toggleDrawer(false)} on:click={() => toggleDrawer(false)}>DMs</a>
		</li>
	</ul>
	<div class="divider" />
	<ul class="menu w-full">
		<li>
			<a href="https://github.com/sillvva/ddal-next13" target="_blank" rel="noreferrer noopener" class="items-center md:hidden">
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
