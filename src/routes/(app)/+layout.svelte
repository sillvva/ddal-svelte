<script lang="ts">
	import { page } from "$app/stores";
	import Drawer from "$lib/components/Drawer.svelte";
	import { signIn, signOut } from "@auth/sveltekit/client";

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
			<a href="/characters" class="hidden items-center p-2 md:flex">Character Logs</a>
			<a href="/dm-logs" class="hidden items-center p-2 md:flex">DM Logs</a>
			<a href="/dms" class="hidden items-center p-2 md:flex">DMs</a>
			<div class="flex-1">&nbsp;</div>
			<a
				href="https://github.com/sillvva/ddal-svelte"
				target="_blank"
				rel="noreferrer noopener"
				class="hidden items-center p-2 lg:flex"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
					><title>github</title><path
						fill="currentColor"
						d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
					/></svg
				>
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
