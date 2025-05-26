<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { excludedSearchWords, searchSections } from "$lib/constants.js";
	import { getGlobal } from "$lib/stores.svelte";
	import { debounce, hotkey } from "$lib/util";
	import type { SearchData } from "$src/routes/(api)/command/+server";
	import { sorter } from "@sillvva/utils";
	import { Command, Dialog, Separator } from "bits-ui";
	import { twMerge } from "tailwind-merge";
	import Items from "./Items.svelte";

	const defaultSelected: string = searchSections[0].url;
	let global = getGlobal();

	let search = $state("");
	let cmdOpen = $state(false);
	let selected: string = $state(defaultSelected);
	let command = $state<Command.Root | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let category = $state<SearchData[number]["title"] | null>(null);
	let categories = $derived(global.searchData.map((section) => section.title).filter((c) => c !== "Sections"));

	const words = $derived(
		search
			.trim()
			.toLowerCase()
			.match(/(?:[^\s"]+|"[^"]*")+/g)
			?.map((word) => word.replace(/^"|"$/g, ""))
			.filter((word) => word.length > 1 && !excludedSearchWords.has(word)) || []
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

	async function open() {
		cmdOpen = true;
		setTimeout(() => {
			input?.focus();
		}, 100);
	}

	function close() {
		search = "";
		cmdOpen = false;
	}

	function select(value: string) {
		goto(value);
		close();
	}

	const results = $derived(
		global.searchData
			.flatMap((section) => {
				// Early return if category doesn't match
				// if (category && section.title !== category) return [];

				// Skip filtering if query is too short
				if (query.length < 2) {
					const items = section.items.slice(0, category ? 10 : 5);
					return [{ title: section.title, items, count: items.length }];
				}

				// Build search strings once per item
				const filteredItems = section.items
					.filter((item) => {
						if (item.type === "section") return false;

						let searchString = item.name;
						if (item.type === "character") {
							searchString += ` ${item.race} ${item.class} ${item.campaign} L${item.totalLevel} T${item.tier}`;
							searchString += ` ${item.magicItems.map((mi) => mi.name).join(" ")}`;
							searchString += ` ${item.storyAwards.map((sa) => sa.name).join(" ")}`;
						} else if (item.type === "log") {
							if (item.character) searchString += ` ${item.character.name}`;
							if (item.dm) searchString += ` ${item.dm.name}`;
							searchString += ` ${item.magicItemsGained.map((mi) => mi.name).join(" ")}`;
							searchString += ` ${item.storyAwardsGained.map((sa) => sa.name).join(" ")}`;
						}

						return hasMatch(searchString)?.length === words.length;
					})
					.slice(0, 50);

				return [{ title: section.title, items: filteredItems, count: filteredItems.length }];
			})
			.map((section, i, sections) => {
				const previousSections = sections.slice(0, i);
				const previousSectionsCount = previousSections.reduce((sum, s) => sum + s.count, 0);
				return {
					...section,
					previousCount: previousSectionsCount
				};
			})
	);
	const resultsCount = $derived(results.reduce((sum, section) => sum + section.items.length, 0));
</script>

<svelte:document
	{@attach hotkey([
		[
			page.data.isMac ? "meta+k" : "ctrl+k",
			() => {
				open();
			}
		],
		[
			"Escape",
			() => {
				close();
			}
		]
	])}
/>

<Dialog.Root bind:open={cmdOpen} onOpenChange={() => (search = "")}>
	<Dialog.Trigger
		class="hover-hover:md:input hover-hover:md:gap-4 hover-hover:md:cursor-text"
		aria-label="Search"
		onclick={() => open()}
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
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-base-300/75! modal modal-open">
			<Dialog.Content class="modal-box bg-base-100 relative cursor-default overflow-y-hidden px-4 py-5 drop-shadow-lg sm:p-6">
				<Dialog.Title class="sr-only">Command Search</Dialog.Title>
				<Dialog.Description class="sr-only">
					This is the command menu. Use the arrow keys to navigate and press
					{#if page.data.isMac}
						⌘K
					{:else}
						CTRL+K
					{/if} to open the search bar.
				</Dialog.Description>
				<Command.Root label="Command Menu" bind:this={command} bind:value={selected} class="flex flex-col gap-4" loop>
					<Command.Input bind:ref={input}>
						{#snippet child({ props })}
							<div
								class="join focus-within:border-primary border-input *:focus:border-primary rounded-lg border *:border-y-0 *:first:border-l-0 *:last:border-r-0"
							>
								<label class="input join-item flex w-full flex-1 items-center gap-2">
									<span class="iconify mdi--magnify size-6"></span>
									<input
										{...props}
										type="search"
										placeholder="Search"
										class="outline-0"
										oninput={debounce((ev: Event) => {
											const val = (ev.target as HTMLInputElement).value;
											if (search !== val) {
												search = val;
												command?.updateSelectedToIndex(0);
												if (viewport) viewport.scrollTop = 0;
											}
										}, 200)[0]}
									/>
								</label>
								<select bind:value={category} class="select join-item w-auto">
									<option value={null}>All Categories</option>
									{#each categories as category}
										<option value={category}>{category}</option>
									{/each}
								</select>
							</div>
						{/snippet}
					</Command.Input>
					<Command.List class="flex flex-col gap-2">
						{#if !global.searchData.length}
							<div class="p-4 text-center font-bold">Loading data...</div>
						{:else}
							<div class="relative h-auto data-[results=true]:h-96" data-results={resultsCount > 0}>
								<Command.Empty class="p-4 text-center font-bold">No results found.</Command.Empty>
								<Command.Viewport class="h-full overflow-y-auto" bind:ref={viewport}>
									{#each results as section}
										{#if section.items.length && section.previousCount}
											<Command.Separator class="divider mt-2 mb-0" />
										{/if}
										<Command.Group value={section.title} class={twMerge(!section.items.length && "hidden")}>
											<Command.GroupHeading class="menu-title text-base-content/60 px-5">
												{section.title}
											</Command.GroupHeading>
											<Command.GroupItems class="menu flex w-full flex-col py-0">
												{#snippet child({ props })}
													<ul {...props}>
														{#each section.items as item}
															<Command.Item
																value={item.url}
																onSelect={() => select(item.url)}
																class="flex gap-4 rounded-lg data-[selected]:bg-neutral-500/40"
															>
																{#snippet child({ props })}
																	<li {...props}>
																		<a href={item.url} class="gap-3" onclick={(ev) => ev.preventDefault()}>
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
																					<div class="text-base-content/70 text-xs">
																						Level {item.totalLevel}
																						{item.race}
																						{item.class}
																					</div>
																					{#if search.length >= 2}
																						{#if item.magicItems.some((magicItem) => hasMatch(magicItem.name))}
																							<div class="flex flex-col text-xs">
																								<span class="pt-1 font-bold whitespace-nowrap">Magic Items:</span>
																								<span class="text-base-content/70 flex-1">
																									<Items
																										items={item.magicItems
																											.filter((item) => hasMatch(item.name))
																											.toSorted((a, b) => sorter(a.name, b.name))}
																										textClass="text-xs leading-4"
																									/>
																								</span>
																							</div>
																						{/if}
																						{#if item.storyAwards.some((storyAward) => hasMatch(storyAward.name))}
																							<div class="flex flex-col text-xs">
																								<span class="pt-1 font-bold whitespace-nowrap">Story Awards:</span>
																								<span class="text-base-content/70 flex-1">
																									<Items
																										items={item.storyAwards
																											.filter((item) => hasMatch(item.name))
																											.toSorted((a, b) => sorter(a.name, b.name))}
																										textClass="text-xs leading-4"
																									/>
																								</span>
																							</div>
																						{/if}
																					{/if}
																				</div>
																			{:else if item.type === "log"}
																				<div class="flex flex-col">
																					<div>{item.name}</div>
																					<div class="text-base-content/70 flex gap-2">
																						<span class="text-xs">{new Date(item.date).toLocaleDateString()}</span>
																						<Separator.Root orientation="vertical" class="border-base-content/50 border-l" />
																						{#if item.character}
																							<span class="text-xs">{item.character.name}</span>
																						{:else}
																							<span class="text-xs italic">Unassigned</span>
																						{/if}
																						<Separator.Root orientation="vertical" class="border-base-content/50 border-l" />
																						<span class="text-xs">{item.gold.toLocaleString()} gp</span>
																					</div>
																					{#if search.length >= 2}
																						{#if hasMatch(item.dm.name)}
																							<div class="flex gap-1 text-xs">
																								<span class="font-bold whitespace-nowrap">DM:</span>
																								<span class="text-base-content/70 flex-1">{item.dm.name}</span>
																							</div>
																						{/if}
																						{#if item.magicItemsGained.some((it) => hasMatch(it.name))}
																							<div class="flex flex-col text-xs">
																								<span class="pt-1 font-bold whitespace-nowrap">Magic Items:</span>
																								<span class="text-base-content/70 flex-1">
																									<Items
																										items={item.magicItemsGained
																											.filter((it) => hasMatch(it.name))
																											.toSorted((a, b) => sorter(a.name, b.name))}
																										textClass="text-xs leading-4"
																									/>
																								</span>
																							</div>
																						{/if}
																						{#if item.storyAwardsGained.some((it) => hasMatch(it.name))}
																							<div class="flex flex-col text-xs">
																								<span class="pt-1 font-bold whitespace-nowrap">Story Awards:</span>
																								<span class="text-base-content/70 flex-1">
																									<Items
																										items={item.storyAwardsGained
																											.filter((it) => hasMatch(it.name))
																											.toSorted((a, b) => sorter(a.name, b.name))}
																										textClass="text-xs leading-4"
																									/>
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
											</Command.GroupItems>
										</Command.Group>
									{/each}
								</Command.Viewport>
							</div>
						{/if}
					</Command.List>
				</Command.Root>
			</Dialog.Content>
		</Dialog.Overlay>
	</Dialog.Portal>
</Dialog.Root>
