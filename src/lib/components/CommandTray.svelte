<script lang="ts">
	import { goto } from "$app/navigation";
	import { searchSections } from "$lib/constants.js";
	import { global } from "$lib/stores.svelte";
	import type { SearchData } from "$src/routes/(api)/command/+server";
	import { sorter } from "@sillvva/utils";
	import { hotkey } from "@svelteuidev/composables";
	import { ScrollArea } from "bits-ui";
	import { Command } from "cmdk-sv";
	import { twMerge } from "tailwind-merge";

	let { isMac = false } = $props();

	const defaultSelected: string = searchSections[0].url;
	const ignoreWords = ["a", "an", "the", "of"];

	let search = $state("");
	let cmdOpen = $state(false);
	let selected: string = $state(defaultSelected);
	let resultsPane: HTMLElement | undefined = $state();

	const words = $derived(
		search
			.toLowerCase()
			.split(" ")
			.filter((word) => word.length > 1 && !ignoreWords.includes(word))
	);
	const query = $derived(words.join(" "));

	$effect(() => {
		if (!global.searchData.length && cmdOpen) {
			fetch(`/command`)
				.then((res) => res.json() as Promise<SearchData>)
				.then((res) => (global.searchData = res));
		}
	});

	function hasMatch(item: string) {
		const matches = words.filter((word) => item.toLowerCase().includes(word));
		return matches.length ? matches : null;
	}

	function close() {
		cmdOpen = false;
		search = "";
		selected = defaultSelected;
	}

	const results = $derived(
		global.searchData.flatMap((section) => {
			const filteredItems = section.items
				.filter((item) => {
					if (item.type === "section" && words.length) return false;
					const matcher = [item.name];
					if (query.length >= 2) {
						if (item.type === "character") {
							matcher.push(`${item.race} ${item.class} ${item.campaign} L${item.total_level} T${item.tier}`);
							matcher.push(...item.magic_items.map((mi) => mi.name), ...item.story_awards.map((sa) => sa.name));
						} else if (item.type === "log") {
							if (item.dm) matcher.push(item.dm.name);
							matcher.push(...item.magicItemsGained.map((mi) => mi.name), ...item.storyAwardsGained.map((sa) => sa.name));
						}
					}
					const matches = words.length ? hasMatch(matcher.join(" ")) : [];
					return matches?.length === words.length;
				})
				.sort((a, b) => {
					if (a.type === "log" && b.type === "log") return new Date(b.date).getTime() - new Date(a.date).getTime();
					const aMatch = hasMatch(a.name);
					const bMatch = hasMatch(b.name);
					if (aMatch && !bMatch) return -1;
					if (!aMatch && bMatch) return 1;
					return a.name.localeCompare(b.name);
				})
				.slice(0, words.length ? 1000 : 5);

			return filteredItems.length ? [{ title: section.title, items: filteredItems }] : [];
		})
	);
	const resultCounts = $derived(results.map((section) => section.items.length).filter((c) => c > 0).length);
</script>

<button
	onclick={() => (cmdOpen = true)}
	class="inline-flex w-10 items-center justify-center hover-hover:md:hidden"
	aria-label="Open Command Tray"
>
	<span class="iconify size-6 mdi--magnify"></span>
</button>
<label class="input input-bordered hidden min-w-fit cursor-text items-center gap-2 hover-hover:md:flex">
	<input type="text" class="max-w-20 grow" placeholder="Search" aria-label="Search" onfocus={() => (cmdOpen = true)} />
	<kbd class="kbd kbd-sm">
		{#if isMac}
			⌘
		{:else}
			CTRL
		{/if}
	</kbd>
	<kbd class="kbd kbd-sm">K</kbd>
</label>

<dialog
	class={twMerge("modal !bg-base-300/75")}
	open={!!cmdOpen || undefined}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	use:hotkey={[
		[
			isMac ? "meta+k" : "ctrl+k",
			() => {
				cmdOpen = true;
			}
		],
		[
			"Escape",
			() => {
				close();
			}
		]
	]}
>
	<div class="modal-box relative cursor-default bg-base-100 px-4 py-5 drop-shadow-lg sm:p-6">
		<div class="modal-content">
			<Command.Dialog
				label="Command Menu"
				portal={null}
				bind:open={cmdOpen}
				bind:value={selected}
				class="flex flex-col gap-4"
				loop
			>
				<label class="input input-bordered flex items-center gap-2 member-focus:border-primary">
					<input
						class="member grow"
						type="search"
						bind:value={search}
						placeholder="Search"
						oninput={() => {
							const firstResult = results[0]?.items[0]?.url;
							if (search && firstResult) selected = firstResult;
							else selected = defaultSelected;
							if (resultsPane) resultsPane.scrollTop = 0;
						}}
						onkeydown={(e) => {
							if (e.key === "Enter") {
								if (selected) {
									goto(selected);
									close();
								} else {
									const firstResult = results[0]?.items[0]?.url;
									if (search && firstResult) selected = firstResult;
									else selected = defaultSelected;
									if (resultsPane) resultsPane.scrollTop = 0;
								}
							}
						}}
					/>
					<span class="iconify size-6 mdi--magnify"></span>
				</label>
				<Command.List class="flex flex-col gap-2" bind:el={resultsPane}>
					{#if !global.searchData.length}
						<div class="p-4 text-center font-bold">Loading data...</div>
					{:else}
						<Command.Empty class="p-4 text-center font-bold">No results found.</Command.Empty>

						<ScrollArea.Root class={twMerge("relative", resultCounts > 0 ? "h-96" : "h-0")}>
							<ScrollArea.Viewport class="h-full">
								<ScrollArea.Content>
									{#each results as section, i}
										{#if i > 0}
											<div class="divider"></div>
										{/if}
										<Command.Group asChild let:group>
											<ul class="menu p-0" {...group.attrs}>
												<li class="menu-title">{section.title}</li>
												{#each section.items as item}
													<Command.Item asChild let:attrs value={item.url}>
														<li
															{...attrs}
															data-selected={selected === item.url ? "true" : undefined}
															class:selected={selected === item.url}
														>
															<a href={item.url} onclick={() => close()} class="flex gap-4 [.selected>&]:bg-neutral-500/40">
																{#if item.type === "character"}
																	<span class="mask mask-squircle h-12 min-w-12 max-w-12 bg-primary">
																		<img
																			src={item.imageUrl}
																			class="size-full object-cover object-top transition-all"
																			alt={item.name}
																		/>
																	</span>
																	<div class="flex flex-col">
																		<div>{item.name}</div>
																		<div class="text-xs opacity-70">
																			Level {item.total_level}
																			{item.race}
																			{item.class}
																		</div>
																		{#if search.length >= 2}
																			{#if item.magic_items.some((magicItem) => hasMatch(magicItem.name))}
																				<div class="flex gap-1 text-xs">
																					<span class="whitespace-nowrap font-bold">Magic Items:</span>
																					<span class="flex-1 opacity-70">
																						{item.magic_items
																							.map((item) => item.name)
																							.filter((item) => hasMatch(item))
																							.sort((a, b) => sorter(a, b))
																							.join(", ")}
																					</span>
																				</div>
																			{/if}
																			{#if item.story_awards.some((storyAward) => hasMatch(storyAward.name))}
																				<div class="flex gap-2 text-xs">
																					<span class="whitespace-nowrap font-bold">Story Awards:</span>
																					<span class="flex-1 opacity-70">
																						{item.story_awards
																							.map((item) => item.name)
																							.filter((item) => hasMatch(item))
																							.sort((a, b) => sorter(a, b))
																							.join(", ")}
																					</span>
																				</div>
																			{/if}
																		{/if}
																	</div>
																{:else if item.type === "log"}
																	<div class="flex flex-col">
																		<div>{item.name}</div>
																		<div class="flex gap-2 divide-x divide-base-content/50 opacity-70">
																			<span class="text-xs">{new Date(item.date).toLocaleDateString()}</span>
																			{#if item.character}
																				<span class="pl-2 text-xs">{item.character.name}</span>
																			{:else}
																				<span class="pl-2 text-xs italic">Unassigned</span>
																			{/if}
																			<span class="pl-2 text-xs">{item.gold.toLocaleString()} gp</span>
																		</div>
																		{#if search.length >= 2}
																			{#if item.dm && hasMatch(item.dm.name)}
																				<div class="flex gap-1 text-xs">
																					<span class="whitespace-nowrap font-bold">DM:</span>
																					<span class="flex-1 opacity-70">{item.dm.name}</span>
																				</div>
																			{/if}
																			{#if item.magicItemsGained.length}
																				<div class="flex gap-1 text-xs">
																					<span class="whitespace-nowrap font-bold">Magic Items:</span>
																					<span class="flex-1 opacity-70">
																						{item.magicItemsGained
																							.map((it) => it.name)
																							.filter(
																								(it) =>
																									!item.magicItemsGained.some((magicItem) => hasMatch(magicItem.name)) ||
																									hasMatch(it)
																							)
																							.sort((a, b) => sorter(a, b))
																							.join(", ")}
																					</span>
																				</div>
																			{/if}
																			{#if item.storyAwardsGained.length}
																				<div class="flex gap-2 text-xs">
																					<span class="whitespace-nowrap font-bold">Story Awards:</span>
																					<span class="flex-1 opacity-70">
																						{item.storyAwardsGained
																							.map((it) => it.name)
																							.filter(
																								(it) =>
																									!item.storyAwardsGained.some((storyAward) => hasMatch(storyAward.name)) ||
																									hasMatch(it)
																							)
																							.sort((a, b) => sorter(a, b))
																							.join(", ")}
																					</span>
																				</div>
																			{/if}
																		{/if}
																	</div>
																{:else}
																	{item.name}
																{/if}
															</a>
														</li>
													</Command.Item>
												{/each}
											</ul>
										</Command.Group>
									{/each}
								</ScrollArea.Content>
							</ScrollArea.Viewport>
							<ScrollArea.Scrollbar
								orientation="vertical"
								class="flex h-full w-2.5 touch-none select-none rounded-full bg-base-200/50 p-px"
							>
								<ScrollArea.Thumb class="relative flex-1 rounded-full bg-black/20 dark:bg-white/20" />
							</ScrollArea.Scrollbar>
							<ScrollArea.Corner />
						</ScrollArea.Root>
					{/if}
				</Command.List>
			</Command.Dialog>
		</div>
	</div>

	<button class="modal-backdrop" onclick={() => close()}>✕</button>
</dialog>
