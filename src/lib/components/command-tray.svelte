<script lang="ts">
	import { hotkey } from "#lib/attachments.js";
	import * as API from "#lib/remote/index.js";
	import { fork, type Fork } from "svelte";

	const request = await API.app.queries.request();

	let open = $state(false);
	let pending: Fork | null = null;

	function preload() {
		if (open) return;
		pending ??= fork(() => {
			open = true;
		});
	}

	function discard() {
		pending?.discard();
		pending = null;
	}

	function openTray() {
		void pending?.commit();
		pending = null;
		open = true;
	}

	function closeTray() {
		discard();
		open = false;
	}

	function load() {
		if (open) return;
		void API.command.queries.getCommandData().catch(() => {});
	}
</script>

<button
	type="button"
	class="touch-hitbox h-10 w-auto hover-hover:md:input hover-hover:md:cursor-text hover-hover:md:gap-4"
	aria-label="Search"
	aria-haspopup="dialog"
	aria-expanded={open}
	onpointerenter={preload}
	onfocusin={preload}
	onpointerleave={discard}
	onfocusout={discard}
	onpointerdown={load}
	onclick={openTray}
	{@attach hotkey([
		["mod+k", openTray],
		["Escape", closeTray]
	])}
>
	<span class="flex items-center gap-1 hover-hover:md:text-base-content/60">
		<span class="iconify size-6 mdi--magnify max-md:w-10 hover-hover:md:size-4 hover-none:w-10"></span>
		<span class="hover-hover:max-md:hidden hover-none:hidden">Search</span>
	</span>
	<span class="hover-hover:max-md:hidden hover-none:hidden">
		<kbd class="kbd kbd-sm">
			{request.isMac ? "⌘" : "CTRL"}
		</kbd>
		<kbd class="kbd kbd-sm">K</kbd>
	</span>
</button>

{#if open}
	<svelte:boundary>
		{@const { default: CommandTrayDialog } = await import("./command-tray-dialog.svelte")}
		<CommandTrayDialog bind:open />

		{#snippet pending()}
			<div class="modal-open modal bg-base-300/75!">
				<div class="relative modal-box cursor-default overflow-y-hidden bg-base-100 px-4 py-5 drop-shadow-lg sm:p-6">
					<div class="p-4 text-center font-bold">Loading data...</div>
				</div>
			</div>
		{/snippet}
	</svelte:boundary>
{/if}
