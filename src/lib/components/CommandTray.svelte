<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { excludedSearchWords, searchSections } from "$lib/constants.js";
	import { global } from "$lib/stores.svelte";
	import type { SearchData } from "$src/routes/(api)/command/+server";
	import { sorter } from "@sillvva/utils";
	import { hotkey } from "@svelteuidev/composables";
	import { Command } from "bits-ui";

	const defaultSelected: string = searchSections[0].url;

	let search = $state("");
	let cmdOpen = $state(false);
	let selected: string = $state(defaultSelected);
	let viewport = $state<HTMLDivElement | null>(null);

	const words = $derived(
		search
			.toLowerCase()
			.split(" ")
			.filter((word) => word.length > 1 && !excludedSearchWords.has(word))
	);
	const query = $derived(words.join(" "));

	$effect(() => {
		const controller = new AbortController();
		if (!global.searchData.length && cmdOpen) {
			fetch(`/command`, { signal: controller.signal })
				.then((res) => res.json() as Promise<SearchData>)
				.then((res) => (global.searchData = res));
		} else {
			controller.abort();
		}

		return () => {
			controller.abort();
		};
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

	function focus(node: HTMLInputElement) {
		setTimeout(() => {
			node.focus();
		}, 100);
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
				.toSorted((a, b) => {
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
	class="hover-hover:md:input hover-hover:md:gap-4 hover-hover:md:cursor-text"
	aria-label="Search"
	onclick={() => (cmdOpen = true)}
>
	<span class="hover-hover:md:text-base-content/60 flex items-center gap-1">
		<span class="iconify mdi--magnify hover-hover:md:size-4 hover-none:w-10 size-6 max-md:w-10"></span>
		<span class="hover-hover:max-md:hidden hover-none:hidden">Search</span>
	</span>
	<span class="hover-hover:max-md:hidden hover-none:hidden">
		<kbd class="kbd kbd-sm">
			{#if page.data.isMac}
				⌘
			{:else}
				CTRL
			{/if}
		</kbd>
		<kbd class="kbd kbd-sm">K</kbd>
	</span>
</button>

<dialog
	class="modal bg-base-300/75!"
	open={!!cmdOpen || undefined}
	aria-labelledby="modal-title"
	aria-describedby="modal-content"
	use:hotkey={[
		[
			page.data.isMac ? "meta+k" : "ctrl+k",
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
	<div class="modal-box bg-base-100 relative cursor-default overflow-y-hidden px-4 py-5 drop-shadow-lg sm:p-6">
		<div class="modal-content">
			<Command.Root label="Command Menu" bind:value={selected} class="flex flex-col gap-4" loop>
				<Command.Input>
					{#snippet child()}
						<label class="input focus-within:border-primary flex w-full items-center gap-2">
							<input
								type="search"
								bind:value={search}
								use:focus
								placeholder="Search"
								oninput={() => {
									const firstResult = results[0]?.items[0]?.url;
									if (search && firstResult) selected = firstResult;
									else selected = defaultSelected;
									if (viewport) viewport.scrollTop = 0;
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
											if (viewport) viewport.scrollTop = 0;
										}
									}
								}}
							/>
							<span class="iconify mdi--magnify size-6"></span>
						</label>
					{/snippet}
				</Command.Input>
				<Command.List class="flex flex-col gap-2">
					{#if !global.searchData.length}
						<div class="p-4 text-center font-bold">Loading data...</div>
					{:else}
						<div class="relative h-0 data-[results=true]:h-96" data-results={resultCounts > 0}>
							<Command.Empty class="p-4 text-center font-bold">No results found.</Command.Empty>
							<Command.Viewport class="h-full overflow-y-auto" bind:ref={viewport}>
								{#each results as section, i}
									{#if i > 0}
										<div class="divider"></div>
									{/if}
									<Command.Group>
										{#snippet child({ props })}
											<ul class="menu w-full p-0" {...props}>
												<li class="menu-title">{section.title}</li>
												{#each section.items as item}
													<Command.Item value={item.url}>
														{#snippet child({ props })}
															<li
																{...props}
																data-selected={selected === item.url ? "true" : undefined}
																class:selected={selected === item.url}
															>
																<a href={item.url} onclick={() => close()} class="flex gap-4 [.selected>&]:bg-neutral-500/40">
																	{#if item.type === "character"}
																		<span class="mask mask-squircle bg-primary h-12 max-w-12 min-w-12">
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
																						<span class="font-bold whitespace-nowrap">Magic Items:</span>
																						<span class="flex-1 opacity-70">
																							{item.magic_items
																								.map((item) => item.name)
																								.filter((item) => hasMatch(item))
																								.toSorted((a, b) => sorter(a, b))
																								.join(", ")}
																						</span>
																					</div>
																				{/if}
																				{#if item.story_awards.some((storyAward) => hasMatch(storyAward.name))}
																					<div class="flex gap-2 text-xs">
																						<span class="font-bold whitespace-nowrap">Story Awards:</span>
																						<span class="flex-1 opacity-70">
																							{item.story_awards
																								.map((item) => item.name)
																								.filter((item) => hasMatch(item))
																								.toSorted((a, b) => sorter(a, b))
																								.join(", ")}
																						</span>
																					</div>
																				{/if}
																			{/if}
																		</div>
																	{:else if item.type === "log"}
																		<div class="flex flex-col">
																			<div>{item.name}</div>
																			<div class="divide-base-content/50 flex gap-2 divide-x opacity-70">
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
																						<span class="font-bold whitespace-nowrap">DM:</span>
																						<span class="flex-1 opacity-70">{item.dm.name}</span>
																					</div>
																				{/if}
																				{#if item.magicItemsGained.length}
																					<div class="flex gap-1 text-xs">
																						<span class="font-bold whitespace-nowrap">Magic Items:</span>
																						<span class="flex-1 opacity-70">
																							{item.magicItemsGained
																								.map((it) => it.name)
																								.filter(
																									(it) =>
																										!item.magicItemsGained.some((magicItem) => hasMatch(magicItem.name)) ||
																										hasMatch(it)
																								)
																								.toSorted((a, b) => sorter(a, b))
																								.join(", ")}
																						</span>
																					</div>
																				{/if}
																				{#if item.storyAwardsGained.length}
																					<div class="flex gap-2 text-xs">
																						<span class="font-bold whitespace-nowrap">Story Awards:</span>
																						<span class="flex-1 opacity-70">
																							{item.storyAwardsGained
																								.map((it) => it.name)
																								.filter(
																									(it) =>
																										!item.storyAwardsGained.some((storyAward) => hasMatch(storyAward.name)) ||
																										hasMatch(it)
																								)
																								.toSorted((a, b) => sorter(a, b))
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
														{/snippet}
													</Command.Item>
												{/each}
											</ul>
										{/snippet}
									</Command.Group>
								{/each}
							</Command.Viewport>
						</div>
					{/if}
				</Command.List>
			</Command.Root>
		</div>
	</div>

	<button class="modal-backdrop" onclick={() => close()}>✕</button>
</dialog>
