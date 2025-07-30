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
	<span class="iconify mdi--menu size-6"></span>
</button>
<noscript>
	<span class="flex w-[52px] py-3 pr-4"> </span>
</noscript>
<div
	id="drawer"
	class="bg-base-100 fixed inset-y-0 -left-80 z-50 w-80 px-4 py-4 transition-all data-[open=true]:left-0"
	data-open={drawer}
>
	<ul class="menu menu-lg w-full">
		<li>
			<a
				href="/characters"
				onkeydown={() => toggleDrawer(false)}
				onclick={() => toggleDrawer(false)}
				data-active={page.url.pathname.startsWith("/characters")}
				class="data-[active=true]:bg-primary data-[active=true]:text-primary-content"
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
				class="data-[active=true]:bg-primary data-[active=true]:text-primary-content"
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
				class="data-[active=true]:bg-primary data-[active=true]:text-primary-content"
			>
				DMs
			</a>
		</li>
	</ul>
	{#if page.data.user?.role === "admin"}
		<div class="divider my-0"></div>
		<ul class="menu menu-lg w-full">
			<li>
				<a
					href="/admin/users"
					onkeydown={() => toggleDrawer(false)}
					onclick={() => toggleDrawer(false)}
					data-active={page.url.pathname.startsWith("/admin/users")}
					class="data-[active=true]:bg-primary data-[active=true]:text-primary-content"
				>
					Users
				</a>
			</li>
			<li>
				<a
					href="/admin/logs"
					onkeydown={() => toggleDrawer(false)}
					onclick={() => toggleDrawer(false)}
					data-active={page.url.pathname.startsWith("/admin/logs")}
					class="data-[active=true]:bg-primary data-[active=true]:text-primary-content"
				>
					Logs
				</a>
			</li>
		</ul>
	{/if}
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
	class="bg-base-300/50 fixed inset-0 -z-10 opacity-0 transition-all data-[backdrop=false]:hidden data-[open=true]:z-40 data-[open=true]:opacity-100"
></div>
