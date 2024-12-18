<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { excludedSearchWords } from "$lib/constants.js";
	import { getTransition, global } from "$lib/stores.svelte.js";
	import { createTransition, isDefined } from "$lib/util";
	import { slugify, sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";

	let { data } = $props();

	const transition = getTransition();

	let search = $state(page.url.searchParams.get("s") || "");
	const minisearch = new MiniSearch({
		fields: ["characterName", "campaign", "race", "class", "tier", "level", "magicItems"],
		idField: "characterId",
		processTerm: (term) => (excludedSearchWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	const indexed = $derived(
		data.characters
			? data.characters.map((character) => ({
					characterId: character.id,
					characterName: character.name,
					campaign: character.campaign || "",
					race: character.race || "",
					class: character.class || "",
					tier: `T${character.tier}`,
					level: `L${character.total_level}`,
					magicItems: character.magic_items.map((item) => item.name).join(", ")
				}))
			: []
	);

	$effect(() => {
		minisearch.removeAll();
		minisearch.addAll(indexed);
	});

	const msResults = $derived.by(() => {
		if (!minisearch.termCount) minisearch.addAll(indexed);
		return minisearch.search(search);
	});
	const resultsMap = $derived(new Map(msResults.map((result) => [result.id, result])));
	const results = $derived(
		indexed.length && search.length > 1
			? data.characters
					.filter((character) => resultsMap.has(character.id))
					.map((character) => {
						const { score = character.name, match = {} } = resultsMap.get(character.id) || {};
						return {
							...character,
							score: score,
							match: Object.values(match)
								.map((value) => value[0])
								.filter(isDefined)
						};
					})
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
			: data.characters
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
					.map((character) => ({ ...character, score: 0, match: [] }))
	);
</script>

<div
	use:hotkey={[
		[
			"n",
			() => {
				goto(`/characters/new`);
			}
		]
	]}
></div>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex">
		<BreadCrumbs />

		<Dropdown class="dropdown-end">
			{#snippet children({ close })}
				<summary tabindex="0" class="btn btn-sm">
					<span class="iconify size-6 mdi--dots-horizontal"></span>
				</summary>
				<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
					<li use:close>
						<button use:download={{ blob: new Blob([JSON.stringify(data.characters)]), filename: "characters.json" }}
							>Export</button
						>
					</li>
				</ul>
			{/snippet}
		</Dropdown>
	</div>

	{#if !data.characters.length}
		<section class="bg-base-200">
			<div class="py-20 text-center">
				<p class="mb-4">You have no log sheets.</p>
				<p>
					<a href="/characters/new" class="btn btn-primary">Create one now</a>
				</p>
			</div>
		</section>
	{:else}
		<div class="flex flex-wrap justify-between gap-2">
			<div class="flex w-full gap-2 sm:max-w-md md:max-w-md">
				<a href="/characters/new/edit" class="btn btn-primary btn-sm max-sm:hidden">New Character</a>
				<Search bind:value={search} placeholder="Search by name, race, class, items, etc." />
				<a href="/characters/new/edit" class="btn btn-primary sm:hidden" aria-label="New Character">
					<span class="iconify inline size-6 mdi--plus"></span>
				</a>
				<button
					class="btn inline-flex data-[enabled=true]:btn-primary xs:hidden"
					data-enabled={global.app.characters.magicItems}
					onclick={() => (global.app.characters.magicItems = !global.app.characters.magicItems)}
					onkeypress={() => null}
					aria-label="Toggle Magic Items"
					tabindex="0"
				>
					{#if global.app.characters.magicItems}
						<span class="iconify size-6 mdi--shield-sword"></span>
					{:else}
						<span class="iconify size-6 mdi--shield-sword-outline"></span>
					{/if}
				</button>
			</div>
			<div class="ml-auto flex gap-2 sm:ml-0">
				{#if global.app.characters.display != "grid"}
					<button
						class="btn data-[enabled=true]:btn-primary sm:btn-sm max-xs:hidden"
						data-enabled={global.app.characters.magicItems}
						onclick={() => createTransition(() => (global.app.characters.magicItems = !global.app.characters.magicItems))}
						onkeypress={() => null}
						aria-label="Toggle Magic Items"
						tabindex="0"
					>
						{#if global.app.characters.magicItems}
							<span class="iconify size-6 mdi--eye max-xs:hidden sm:max-md:hidden"></span>
							<span class="iconify size-6 mdi--shield-sword xs:max-sm:hidden md:hidden"></span>
						{:else}
							<span class="iconify size-6 mdi--eye-off max-xs:hidden sm:max-md:hidden"></span>
							<span class="iconify size-6 mdi--shield-sword-outline xs:max-sm:hidden md:hidden"></span>
						{/if}
						<span class="max-xs:hidden sm:max-md:hidden">Magic Items</span>
					</button>
				{/if}
				<div class="join max-xs:hidden">
					<button
						class="btn join-item data-[display=list]:btn-primary data-[display=grid]:hover:btn-primary sm:btn-sm"
						data-display={global.app.characters.display}
						onclick={() => createTransition(() => (global.app.characters.display = "list"))}
						onkeypress={() => null}
						aria-label="List View"
					>
						<span class="iconify mdi--format-list-text"></span>
					</button>
					<button
						class="btn join-item data-[display=grid]:btn-primary data-[display=list]:hover:btn-primary sm:btn-sm"
						data-display={global.app.characters.display}
						onclick={() => createTransition(() => (global.app.characters.display = "grid"))}
						onkeypress={() => null}
						aria-label="Grid View"
					>
						<span class="iconify mdi--view-grid"></span>
					</button>
				</div>
			</div>
		</div>

		<div>
			<div
				class="w-full overflow-x-auto rounded-lg data-[display=grid]:block data-[display=grid]:xs:hidden"
				data-display={global.app.characters.display}
			>
				<div
					class="grid-table grid-characters-mobile sm:grid-characters data-[mobile=true]:grid-characters-mobile data-[mobile=true]:sm:grid-characters-mobile-sm bg-base-200"
					data-mobile={data.mobile}
				>
					<header class="!hidden text-base-content/70 sm:!contents">
						{#if !data.mobile}
							<div class="max-sm:hidden"></div>
						{/if}
						<div>Name</div>
						<div>Campaign</div>
						<div class="text-center">Tier</div>
						<div class="text-center">Level</div>
					</header>
					{#each results as character}
						<a href={`/characters/${character.id}`} class="img-grow" aria-label={character.name}>
							{#if !data.mobile}
								<div class="pr-0 transition-colors max-sm:hidden sm:pr-2">
									<div class="avatar">
										<div class="mask mask-squircle size-12 bg-primary" use:transition={slugify("image-" + character.id)}>
											{#if character.imageUrl}
												{#key character.imageUrl}
													<img
														src={character.imageUrl}
														width={48}
														height={48}
														class="size-full object-cover object-top"
														alt={character.name}
														loading="lazy"
													/>
												{/key}
											{:else}
												<span class="iconify size-12 mdi--account"></span>
											{/if}
										</div>
									</div>
								</div>
							{/if}
							<div>
								<div class="whitespace-pre-wrap text-base font-bold text-black dark:text-white sm:text-xl">
									<span use:transition={slugify("name-" + character.id)}>
										<SearchResults text={character.name} {search} />
									</span>
								</div>
								<div class="whitespace-pre-wrap text-xs sm:text-sm" use:transition={slugify("details-" + character.id)}>
									<span class="inline pr-1 sm:hidden">Level {character.total_level}</span><SearchResults
										text={character.race}
										{search}
									/>
									<SearchResults text={character.class} {search} />
								</div>
								<div class="mb-2 block text-xs sm:hidden" use:transition={slugify("campaign-" + character.id)}>
									<SearchResults text={character.campaign} {search} />
								</div>
								{#if (character.match.includes("magicItems") || global.app.characters.magicItems) && character.magic_items.length}
									<div class="mb-2">
										<p class="font-semibold">Magic Items:</p>
										<SearchResults text={character.magic_items.map((item) => item.name)} {search} />
									</div>
								{/if}
							</div>
							<div class="hidden transition-colors sm:flex">
								<span use:transition={slugify("campaign-" + character.id)}>
									<SearchResults text={character.campaign} {search} />
								</span>
							</div>
							<div class="hidden justify-center transition-colors sm:flex">
								<span use:transition={slugify("tier-" + character.id)}>
									{character.tier}
								</span>
							</div>
							<div class="hidden justify-center transition-colors sm:flex">
								<span use:transition={slugify("level-" + character.id)}>
									{character.total_level}
								</span>
							</div>
						</a>
					{/each}
				</div>
			</div>

			{#each [1, 2, 3, 4] as tier}
				{#if results.filter((c) => c.tier == tier).length}
					<h1
						class="pb-2 font-vecna text-3xl font-bold data-[display=list]:hidden data-[tier-1=false]:pt-6 dark:text-white data-[display=grid]:max-xs:hidden"
						data-display={global.app.characters.display}
						data-tier-1={tier == 1}
					>
						Tier {tier}
					</h1>
					<div
						class="hidden w-full data-[display=grid]:grid-cols-2 data-[display=grid]:gap-4 data-[display=grid]:xs:grid data-[display=grid]:sm:grid-cols-3 data-[display=grid]:md:grid-cols-4"
						data-display={global.app.characters.display}
					>
						{#each results.filter((c) => c.tier == tier) as character}
							{@const miMatches = msResults.find(
								(result) => result.id == character.id && result.terms.find((term) => result.match[term]?.includes("magicItems"))
							)}
							<a
								href={`/characters/${character.id}`}
								class="card card-compact bg-base-200 shadow-xl transition-transform duration-200 motion-safe:hover:scale-105"
								use:transition={slugify("image-" + character.id)}
							>
								<figure class="relative aspect-square overflow-hidden">
									{#key character.imageUrl}
										<img src={character.imageUrl} alt={character.name} class="size-full object-cover object-top" loading="lazy" />
									{/key}
									{#if search.length >= 1 && indexed.length && miMatches}
										<div class="absolute inset-0 flex items-center bg-black/50 p-2 text-center text-xs text-white">
											<div class="flex-1">
												<SearchResults text={character.magic_items.map((item) => item.name)} {search} filtered />
											</div>
										</div>
									{/if}
								</figure>
								<div class="card-body text-center">
									<div class="flex flex-col gap-1">
										<h2
											class="card-title block overflow-hidden text-ellipsis whitespace-nowrap text-balance text-sm dark:text-white"
										>
											<SearchResults text={character.name} {search} />
										</h2>
										<p class="text-balance text-xs"><SearchResults text={`${character.race} ${character.class}`} {search} /></p>
										<p class="text-xs">Level {character.total_level} | Tier {character.tier}</p>
									</div>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
