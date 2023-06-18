<script lang="ts">
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

<button class="flex py-3 pr-4 print:hidden md:hidden" on:click={() => toggleDrawer(true)}>
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
		><title>menu</title><path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" /></svg
	>
</button>
<div
	class={twMerge("fixed -left-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all", drawer && "left-0")}
>
	<ul class="menu w-full" on:keydown={() => toggleDrawer(false)} on:click={() => toggleDrawer(false)}>
		<li>
			<a href="/characters">Character Logs</a>
		</li>
		<li>
			<a href="/dm-logs">DM Logs</a>
		</li>
		<li>
			<a href="/dms">DMs</a>
		</li>
	</ul>
	<div class="divider" />
	<ul class="menu w-full">
		<li>
			<a
				href="https://github.com/sillvva/ddal-next13"
				target="_blank"
				rel="noreferrer noopener"
				class="items-center sm:hidden"
			>
				Github
			</a>
		</li>
		<li>
			<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener"> Contribute </a>
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
/>
