<script lang="ts">
	import { goto } from "$app/navigation";
	import { searchSections } from "#lib/constants.js";
	import { GlobalSearchFactory } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { SearchData } from "#lib/remote/command/index.js";
	import { hotkey } from "#lib/util.js";
	import { Command, Dialog, Separator } from "bits-ui";
	import { untrack } from "svelte";
	import SearchResults from "./search-results.svelte";

	const defaultSelected: string = searchSections[0].url;

	let open = $state(false);
	let selected = $state(defaultSelected);
	let searchData = $state<SearchData>([]);
	let command: Command.Root | undefined;
	let viewport = $state<HTMLDivElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	const request = await API.app.queries.request();
	const search = $derived(new GlobalSearchFactory(searchData, open ? "" : ""));
	const resultsCount = $derived(search.results.reduce((sum, section) => sum + section.items.length, 0));
	const categories = $derived(searchData.map((section) => section.title).filter((c) => c !== "Sections"));

	$effect(() => {
		void search.results;
		untrack(() => {
			command?.updateSelectedToIndex(0);
			if (viewport) viewport.scrollTop = 0;
		});
	});

	async function setOpen(newOpen: boolean) {
		open = newOpen;
		search.query = "";
		if (open) {
			searchData = await API.command.queries.getCommandData();
			input?.focus();
		} else {
			searchData = [];
		}
	}

	function select(value: string) {
		setOpen(false);
		void goto(value).catch(() => {
			window.location.href = value;
		});
	}
</script>

<Dialog.Root bind:open={() => open, setOpen}>
	<Dialog.Trigger
		class="touch-hitbox h-10 w-auto hover-hover:md:input hover-hover:md:cursor-text hover-hover:md:gap-4"
		aria-label="Search"
		{@attach hotkey([
			[
				"mod+k",
				() => {
					setOpen(true);
				}
			],
			[
				"Escape",
				() => {
					setOpen(false);
				}
			]
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
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="modal modal-open bg-base-300/75!">
			<Dialog.Content class="relative modal-box cursor-default overflow-y-hidden bg-base-100 px-4 py-5 drop-shadow-lg sm:p-6">
				<Dialog.Title class="sr-only">Command Search</Dialog.Title>
				<Dialog.Description class="sr-only">This is the command menu. Use the arrow keys to navigate.</Dialog.Description>
				<Command.Root label="Command Menu" bind:this={command} bind:value={selected} class="flex flex-col gap-4" loop>
					<Command.Input bind:ref={input}>
						{#snippet child({ props })}
							<div
								class="join rounded-lg border border-input *:border-y-0 *:first:border-l-0 *:last:border-r-0 focus-within:border-primary *:focus:border-primary"
							>
								<label class="input join-item flex w-full flex-1 items-center gap-2 max-sm:text-base">
									<span class="iconify size-6 mdi--magnify"></span>
									<input
										{...props}
										type="search"
										placeholder="Search"
										class="outline-0"
										oninput={(ev: Event) => {
											const value = (ev.target as HTMLInputElement).value;
											const trimmed = value.trim();
											if (search.query !== trimmed) search.query = trimmed;
										}}
									/>
								</label>
								<select id="search-category" bind:value={search.category} class="select join-item w-auto max-sm:text-base">
									<option value={null}>All Categories</option>
									{#each categories as category (category)}
										<option value={category}>{category}</option>
									{/each}
								</select>
							</div>
						{/snippet}
					</Command.Input>
					<Command.List class="flex flex-col gap-2">
						{#if resultsCount}
							<Command.Viewport class="h-96 overflow-y-auto" bind:ref={viewport}>
								{#each search.results as section (section.title)}
									{#if section.items.length && section.previousCount}
										<Command.Separator class="divider mt-2 mb-0" />
									{/if}
									<Command.Group value={section.title} class={[!section.items.length && "hidden"]}>
										<Command.GroupHeading class="menu-title px-5 text-base-content/60">
											{section.title}
										</Command.GroupHeading>
										<Command.GroupItems class="menu flex w-full flex-col py-0">
											{#snippet child({ props })}
												<ul {...props}>
													{#each section.items as item ("id" in item ? item.id : item.name)}
														<Command.Item
															value={item.url}
															onSelect={() => select(item.url)}
															class="flex gap-4 rounded-lg data-selected:bg-neutral-500/25"
														>
															{#snippet child({ props })}
																<li {...props}>
																	<a href={item.url} class="gap-3" onclick={(ev) => ev.preventDefault()}>
																		{#if item.type === "character"}
																			<span class="mask h-12 max-w-12 min-w-12 bg-primary mask-squircle">
																				<img
																					src={item.imageUrl}
																					class="size-full object-cover object-top transition-all"
																					alt={item.name}
																				/>
																			</span>
																			<div class="flex flex-col">
																				<div>
																					<SearchResults text={item.name} terms={search.terms} />
																				</div>
																				<div class="text-xs text-base-content/70">
																					Level {item.totalLevel}
																					<SearchResults text={item.race} terms={search.terms} />
																					<SearchResults text={item.class} terms={search.terms} />
																				</div>
																				{#if search.query.length >= 2}
																					{#if item.score && search.terms.length}
																						<div class="text-xs text-base-content/70">
																							Match Score: {Math.round(item.score * 100) / 100}
																						</div>
																					{/if}
																					{#if item.match.has("magicItems")}
																						<div class="flex flex-col text-xs">
																							<span class="pt-1 font-bold whitespace-nowrap">Magic Items:</span>
																							<span class="flex-1 text-xs leading-4 text-base-content/70">
																								<SearchResults
																									text={item.magicItems.map((mi) => mi.name)}
																									terms={search.terms}
																									filtered
																									matches={item.match.size}
																								/>
																							</span>
																						</div>
																					{/if}
																					{#if item.match.has("storyAwards")}
																						<div class="flex flex-col text-xs">
																							<span class="pt-1 font-bold whitespace-nowrap">Story Awards:</span>
																							<span class="flex-1 text-xs leading-4 text-base-content/70">
																								<SearchResults
																									text={item.storyAwards.map((sa) => sa.name)}
																									terms={search.terms}
																									filtered
																									matches={item.match.size}
																								/>
																							</span>
																						</div>
																					{/if}
																				{/if}
																			</div>
																		{:else if item.type === "log"}
																			<div class="flex flex-col">
																				<div>
																					<SearchResults text={item.name} terms={search.terms} />
																				</div>
																				<div class="flex gap-2 text-base-content/70">
																					<span class="text-xs">{new Date(item.date).toLocaleDateString()}</span>
																					<Separator.Root orientation="vertical" class="border-l border-base-content/50" />
																					{#if item.character}
																						<span class="text-xs">
																							<SearchResults text={item.character.name} terms={search.terms} />
																						</span>
																					{:else}
																						<span class="text-xs italic">Unassigned</span>
																					{/if}
																					<Separator.Root orientation="vertical" class="border-l border-base-content/50" />
																					<span class="text-xs">{item.gold.toLocaleString()} gp</span>
																				</div>
																				{#if search.query.length >= 2}
																					{#if item.score && search.terms.length}
																						<div class="text-xs text-base-content/70">
																							Match Score: {Math.round(item.score * 100) / 100}
																						</div>
																					{/if}
																					{#if item.match.has("dm")}
																						<div class="flex gap-1 text-xs">
																							<span class="font-bold whitespace-nowrap">DM:</span>
																							<span class="flex-1 text-base-content/70">
																								<SearchResults text={item.dm.name} terms={search.terms} />
																							</span>
																						</div>
																					{/if}
																					{#if item.match.has("magicItemsGained")}
																						<div class="flex flex-col text-xs">
																							<span class="pt-1 font-bold whitespace-nowrap">Magic Items:</span>
																							<span class="flex-1 text-base-content/70">
																								<SearchResults
																									text={item.magicItemsGained.map((mi) => mi.name)}
																									terms={search.terms}
																									filtered
																									matches={item.match.size}
																								/>
																							</span>
																						</div>
																					{/if}
																					{#if item.match.has("storyAwardsGained")}
																						<div class="flex flex-col text-xs">
																							<span class="pt-1 font-bold whitespace-nowrap">Story Awards:</span>
																							<span class="flex-1 text-base-content/70">
																								<SearchResults
																									text={item.storyAwardsGained.map((sa) => sa.name)}
																									terms={search.terms}
																									filtered
																									matches={item.match.size}
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
						{:else if !searchData.length}
							<Command.Empty class="p-4 text-center font-bold">Loading data...</Command.Empty>
						{:else}
							<Command.Empty class="p-4 text-center font-bold">No results found.</Command.Empty>
						{/if}
					</Command.List>
				</Command.Root>
			</Dialog.Content>
		</Dialog.Overlay>
	</Dialog.Portal>
</Dialog.Root>
