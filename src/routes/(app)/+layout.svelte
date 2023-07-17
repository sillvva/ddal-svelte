<script lang="ts">
	import { page } from "$app/stores";
	import Drawer from "$lib/components/Drawer.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Markdown from "$src/lib/components/Markdown.svelte";
	import { modal } from "$src/lib/store";
	import { signIn, signOut } from "@auth/sveltekit/client";
	import { twMerge } from "tailwind-merge";

	export let data;
</script>

<div class="relative flex min-h-screen flex-col">
	<header class="relative z-20 w-full border-b-[1px] border-slate-500">
		<nav class="container mx-auto flex max-w-5xl gap-2 p-4">
			<Drawer />
			<a href={data.session?.user ? "/characters" : "/"} class="mr-8 flex flex-col text-center font-draconis">
				<h1 class="text-base leading-4 text-accent-content">Adventurers League</h1>
				<h2 class="text-3xl leading-7">Log Sheet</h2>
			</a>
			{#if data.session?.user}
				<a href="/characters" class="hidden items-center p-2 md:flex">Character Logs</a>
				<a href="/dm-logs" class="hidden items-center p-2 md:flex">DM Logs</a>
				<a href="/dms" class="hidden items-center p-2 md:flex">DMs</a>
			{/if}
			<div class="flex-1">&nbsp;</div>
			<a
				href="https://github.com/sillvva/ddal-svelte"
				target="_blank"
				rel="noreferrer noopener"
				class="hidden items-center p-2 lg:flex"
			>
				<Icon src="github" class="w-6" />
			</a>
			<a href="http://paypal.me/Sillvva" target="_blank" rel="noreferrer noopener" class="hidden items-center p-2 lg:flex">
				Contribute
			</a>
			{#if data.session?.user}
				<div class="dropdown-end dropdown">
					<div role="button" tabindex="0" class="flex cursor-pointer">
						<div class="hidden items-center px-4 text-accent-content print:flex sm:flex">
							{data.session?.user?.name}
						</div>
						<div class="avatar">
							<div class="relative w-11 overflow-hidden rounded-full ring ring-primary ring-offset-2 ring-offset-base-100">
								<img
									src={data.session?.user?.image || ""}
									alt={data.session?.user?.name}
									width={48}
									height={48}
									class="rounded-full object-cover object-center"
								/>
							</div>
						</div>
					</div>
					<ul class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
						<li class="sm:hidden">
							<span>{data.session?.user?.name}</span>
						</li>
						<li>
							<a href="#top" on:click={() => signOut()}>Logout</a>
						</li>
					</ul>
				</div>
			{:else}
				<button
					class="flex h-12 items-center gap-2 rounded-lg bg-base-200/50 p-2 text-base-content transition-colors hover:bg-base-300"
					on:click={() =>
						signIn("google", {
							callbackUrl: `${$page.url.origin}/characters`
						})}
				>
					<img src="/images/google.svg" width="24" height="24" alt="Google" />
					<span class="flex h-full flex-1 items-center justify-center font-semibold">Sign In</span>
				</button>
			{/if}
		</nav>
	</header>
	<div class="container relative z-10 mx-auto max-w-5xl flex-1 p-4"><slot /></div>
	<footer class="z-16 footer footer-center relative bg-base-300/50 p-4 text-base-content print:hidden">
		<div>
			<p>
				All
				<a
					href="https://www.dndbeyond.com/sources/cos/the-lands-of-barovia#BGatesofBarovia"
					target="_blank"
					rel="noreferrer noopener"
					class="text-secondary"
				>
					images
				</a>
				and the name
				<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary">
					Adventurers League
				</a>
				are property of Hasbro and
				<a href="https://dnd.wizards.com/adventurers-league" target="_blank" rel="noreferrer noopener" class="text-secondary">
					Wizards of the Coast
				</a>. This website is affiliated with neither.
			</p>
		</div>
	</footer>
</div>

<div
	role="presentation"
	class={twMerge("modal cursor-pointer !bg-black/50", $modal && "modal-open")}
	on:click={() => ($modal = null)}
	on:keypress={() => null}
>
	{#if $modal}
		<div
			role="presentation"
			class="modal-box relative cursor-default drop-shadow-lg"
			on:click={(e) => e.stopPropagation()}
			on:keypress={() => null}
		>
			<h3 class="cursor-text text-lg font-bold text-accent-content">{$modal.name}</h3>
			{#if $modal.date}
				<p class="text-xs">{$modal.date.toLocaleString()}</p>
			{/if}
			<Markdown content={$modal.description} class="cursor-text whitespace-pre-wrap pt-4 text-sm sm:text-md" />
		</div>
	{/if}
</div>
