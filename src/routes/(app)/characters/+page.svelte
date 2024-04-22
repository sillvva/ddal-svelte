<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { stopWords } from "$lib/constants.js";
	import type { TransitionAction } from "$lib/util";
	import { createTransition, isDefined } from "$lib/util";
	import type { CookieStore } from "$server/cookie.js";
	import { slugify, sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";
	import { getContext, onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let data;

	$: characters = data.characters;
	let search = $page.url.searchParams.get("s") || "";
	let loaded = false;

	const app = getContext<CookieStore<App.Cookie>>("app");
	const transition = getContext<TransitionAction>("transition");

	onMount(() => {
		setTimeout(() => (loaded = true), 1000);
	});

	const minisearch = new MiniSearch({
		fields: ["characterName", "campaign", "race", "class", "tier", "level", "magicItems"],
		idField: "characterId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	$: indexed = characters
		? characters.map((character) => ({
				characterId: character.id,
				characterName: character.name,
				campaign: character.campaign || "",
				race: character.race || "",
				class: character.class || "",
				tier: `T${character.tier}`,
				level: `L${character.total_level}`,
				magicItems: character.magic_items.map((item) => item.name).join(", ")
			}))
		: [];

	$: {
		minisearch.removeAll();
		minisearch.addAll(indexed);
	}
	$: msResults = minisearch.search(search);
	$: resultsMap = new Map(msResults.map((result) => [result.id, result]));
	$: results =
		indexed.length && search.length > 1
			? characters
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
			: characters
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
					.map((character) => ({ ...character, score: 0, match: [] }));
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
/>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex">
		<BreadCrumbs />

		<Dropdown class="dropdown-end" let:close>
			<summary tabindex="0" class="btn btn-sm bg-base-100">
				<span class="iconify size-6 mdi-dots-horizontal" />
			</summary>
			<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
				<li use:close>
					<button use:download={{ blob: new Blob([JSON.stringify(characters)]), filename: "characters.json" }}>Export</button>
				</li>
			</ul>
		</Dropdown>
	</div>

	{#if !characters.length}
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
					<span class="iconify inline size-6 mdi-plus" />
				</a>
				<button
					class={twMerge("btn inline-flex xs:hidden", $app.characters.magicItems && "btn-primary")}
					on:click={() => ($app.characters.magicItems = !$app.characters.magicItems)}
					on:keypress={() => null}
					on:keypress
					aria-label="Toggle Magic Items"
					tabindex="0"
				>
					{#if $app.characters.magicItems}
						<span class="iconify size-6 mdi-shield-sword" />
					{:else}
						<span class="iconify size-6 mdi-shield-sword-outline" />
					{/if}
				</button>
			</div>
			<div class="ml-auto flex gap-2 sm:ml-0">
				{#if $app.characters.display != "grid"}
					<button
						class={twMerge("btn sm:btn-sm max-xs:hidden", $app.characters.magicItems && "btn-primary")}
						on:click={() => createTransition(() => ($app.characters.magicItems = !$app.characters.magicItems))}
						on:keypress={() => null}
						on:keypress
						aria-label="Toggle Magic Items"
						tabindex="0"
					>
						{#if $app.characters.magicItems}
							<span class="iconify size-6 mdi-eye max-xs:hidden sm:max-md:hidden" />
							<span class="iconify size-6 mdi-shield-sword xs:max-sm:hidden md:hidden" />
						{:else}
							<span class="iconify size-6 mdi-eye-off max-xs:hidden sm:max-md:hidden" />
							<span class="iconify size-6 mdi-shield-sword-outline xs:max-sm:hidden md:hidden" />
						{/if}
						<span class="max-xs:hidden sm:max-md:hidden">Magic Items</span>
					</button>
				{/if}
				<div class="join max-xs:hidden">
					<button
						class={twMerge("btn join-item sm:btn-sm", $app.characters.display == "list" ? "btn-primary" : "hover:btn-primary")}
						on:click={() => createTransition(() => ($app.characters.display = "list"))}
						on:keypress
						aria-label="List View"
					>
						<span class="iconify mdi-format-list-text" />
					</button>
					<button
						class={twMerge("btn join-item sm:btn-sm", $app.characters.display == "grid" ? "btn-primary" : "hover:btn-primary")}
						on:click={() => createTransition(() => ($app.characters.display = "grid"))}
						on:keypress
						aria-label="Grid View"
					>
						<span class="iconify mdi-view-grid" />
					</button>
				</div>
			</div>
		</div>

		<div>
			<div class={twMerge("w-full overflow-x-auto rounded-lg", $app.characters.display == "grid" && "block xs:hidden")}>
				<div
					class={twMerge(
						"grid-table bg-base-200",
						data.mobile ? "grid-characters-mobile sm:grid-characters-mobile-sm" : "grid-characters-mobile sm:grid-characters"
					)}
				>
					<header class="!hidden text-base-content/70 sm:!contents">
						{#if !data.mobile}
							<div class="max-sm:hidden" />
						{/if}
						<div>Name</div>
						<div>Campaign</div>
						<div class="text-center">Tier</div>
						<div class="text-center">Level</div>
					</header>
					{#each results as character}
						<a href={`/characters/${character.id}`} class="img-grow">
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
												<span class="iconify size-12 mdi-account" />
											{/if}
										</div>
									</div>
								</div>
							{/if}
							<div>
								<div class="whitespace-pre-wrap text-base font-bold text-black dark:text-white sm:text-xl">
									<span
										use:transition={{
											name: slugify("name-" + character.id),
											shouldApply: loaded
										}}
									>
										<SearchResults text={character.name} {search} />
									</span>
								</div>
								<div class="whitespace-pre-wrap text-xs sm:text-sm">
									<p
										use:transition={{
											name: slugify("details-" + character.id),
											shouldApply: loaded
										}}
									>
										<span class="inline pr-1 sm:hidden">Level {character.total_level}</span><SearchResults
											text={character.race}
											{search}
										/>
										<SearchResults text={character.class} {search} />
									</p>
								</div>
								<div class="mb-2 block text-xs sm:hidden">
									<p
										use:transition={{
											name: slugify("campaign-" + character.id),
											shouldApply: loaded
										}}
									>
										<SearchResults text={character.campaign} {search} />
									</p>
								</div>
								{#if (character.match.includes("magicItems") || $app.characters.magicItems) && character.magic_items.length}
									<div class="mb-2">
										<p class="font-semibold">Magic Items:</p>
										<SearchResults text={character.magic_items.map((item) => item.name)} {search} />
									</div>
								{/if}
							</div>
							<div class="hidden transition-colors sm:flex">
								<span
									use:transition={{
										name: slugify("campaign-" + character.id),
										shouldApply: loaded
									}}
								>
									<SearchResults text={character.campaign} {search} />
								</span>
							</div>
							<div class="hidden justify-center transition-colors sm:flex">
								<span
									use:transition={{
										name: slugify("tier-" + character.id),
										shouldApply: loaded
									}}>{character.tier}</span
								>
							</div>
							<div class="hidden justify-center transition-colors sm:flex">
								<span
									use:transition={{
										name: slugify("level-" + character.id),
										shouldApply: loaded
									}}>{character.total_level}</span
								>
							</div>
						</a>
					{/each}
				</div>
			</div>

			{#each [1, 2, 3, 4] as tier}
				{#if results.filter((c) => c.tier == tier).length}
					<h1
						class={twMerge(
							"pb-2 font-vecna text-3xl font-bold dark:text-white",
							$app.characters.display == "list" && "hidden",
							$app.characters.display == "grid" && "max-xs:hidden",
							tier > 1 && "pt-6"
						)}
					>
						Tier {tier}
					</h1>
					<div
						class={twMerge(
							"hidden w-full",
							$app.characters.display == "grid" && "grid-cols-2 gap-4 xs:grid sm:grid-cols-3 md:grid-cols-4"
						)}
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
