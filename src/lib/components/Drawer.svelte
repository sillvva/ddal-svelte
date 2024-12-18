<script lang="ts">
	import { page } from "$app/state";

	let drawer = $state(false);
	let backdrop = $state(false);

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
	class="flex min-w-fit py-3 pr-4 md:hidden print:hidden"
	onclick={() => toggleDrawer(true)}
	aria-expanded={drawer}
	aria-controls="drawer"
	aria-label="Toggle Drawer"
>
	<span class="iconify size-6 mdi--menu"></span>
</button>
<noscript>
	<span class="flex w-[52px] py-3 pr-4"> </span>
</noscript>
<div
	id="drawer"
	class="fixed -left-72 bottom-0 top-0 z-50 w-72 bg-base-100 px-4 py-4 transition-all data-[open=true]:left-0"
	data-open={drawer}
>
	<ul class="menu menu-lg w-full">
		<li>
			<a
				href="/characters"
				onkeydown={() => toggleDrawer(false)}
				onclick={() => toggleDrawer(false)}
				data-active={page.url.pathname.startsWith("/characters")}
				class="data-[active=true]:bg-primary data-[active=true]:text-white"
			>
				Character Logs
			</a>
		</li>
		<li>
			<a
				href="/dm-logs"
				onkeydown={() => toggleDrawer(false)}
				onclick={() => toggleDrawer(false)}
				data-active={page.url.pathname.startsWith("/dm-logs")}
				class="data-[active=true]:bg-primary data-[active=true]:text-white"
			>
				DM Logs
			</a>
		</li>
		<li>
			<a
				href="/dms"
				onkeydown={() => toggleDrawer(false)}
				onclick={() => toggleDrawer(false)}
				data-active={page.url.pathname.startsWith("/dms")}
				class="data-[active=true]:bg-primary data-[active=true]:text-white"
			>
				DMs
			</a>
		</li>
	</ul>
	<div class="divider my-0"></div>
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
	onkeydown={() => toggleDrawer(false)}
	onclick={() => toggleDrawer(false)}
	role="none"
	data-backdrop={backdrop}
	data-open={drawer}
	class="fixed inset-0 -z-10 hidden bg-base-300/50 opacity-0 transition-all data-[open=true]:z-40 data-[backdrop=true]:block data-[open=true]:opacity-100"
></div>
