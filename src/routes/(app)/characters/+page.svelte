<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import type { AppStore } from "$lib/schemas";
	import type { TransitionAction } from "$lib/util";
	import { createTransition, slugify, sorter, stopWords } from "$lib/utils";
	import MiniSearch from "minisearch";
	import { getContext, onMount } from "svelte";
	import { queryParam, ssp } from "sveltekit-search-params";
	import { twMerge } from "tailwind-merge";

	export let data;

	let characters = data.characters;
	let loaded = false;

	const app = getContext<AppStore>("app");
	const transition = getContext<TransitionAction>("transition");

	const s = queryParam("s", ssp.string());
	$: search = $s || "";

	onMount(() => {
		setTimeout(() => (loaded = true), 1000);
	});

	const minisearch = new MiniSearch({
		fields: ["characterName", "campaign", "race", "class", "magicItems", "tier", "level"],
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
				magicItems: character.logs
					.reduce((acc, log) => {
						acc.push(...log.magic_items_gained.filter((magicItem) => !magicItem.logLostId).map((magicItem) => magicItem.name));
						return acc;
					}, [] as string[])
					.join(", ")
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
								.filter(Boolean)
						};
					})
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
			: characters
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
					.map((character) => ({ ...character, score: 0, match: [] }));
</script>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex">
		<BreadCrumbs />

		<div class="dropdown dropdown-end">
			<span role="button" tabindex="0" class="btn btn-sm bg-base-100">
				<Icon src="dots-horizontal" class="w-6" />
			</span>
			<ul class="menu dropdown-content w-52 rounded-box bg-base-100 p-2 shadow">
				<li>
					<a download={`characters.json`} href={`/api/export/characters/all`} target="_blank" rel="noreferrer noopener">Export</a>
				</li>
			</ul>
		</div>
	</div>

	{#if !characters.length}
		<section class="bg-base-100">
			<div class="py-20 text-center">
				<p class="mb-4">You have no log sheets.</p>
				<p>
					<a href="/characters/new" class="btn btn-primary">Create one now</a>
				</p>
			</div>
		</section>
	{:else}
		<div class="flex flex-wrap justify-between gap-2">
			<div class="flex w-full gap-2 sm:max-w-lg">
				<a href="/characters/new/edit" class="btn btn-primary btn-sm hidden sm:inline-flex">New Character</a>
				<search class="min-w-0 flex-1">
					<input
						type="text"
						placeholder="Search by name, race, class, items, etc."
						bind:value={$s}
						class="no-script-hide input join-item input-bordered w-full min-w-0 flex-1 sm:input-sm md:w-80"
					/>
					<noscript>
						<form class="join flex">
							<input
								type="text"
								name="s"
								placeholder="Search by name, race, class, items, etc."
								bind:value={$s}
								class="input join-item input-bordered w-full min-w-0 flex-1 sm:input-sm md:w-80"
							/>
							<button type="submit" class="btn btn-primary join-item sm:btn-sm">
								<Icon src="magnify" class="w-6 sm:w-4" />
							</button>
						</form>
					</noscript>
				</search>
				<a href="/characters/new/edit" class="btn btn-primary inline-flex sm:hidden" aria-label="New Character">
					<Icon src="plus" class="inline w-6" />
				</a>
				<button
					class={twMerge("no-script-hide btn inline-flex xs:hidden", $app.characters.magicItems && "btn-primary")}
					on:click={() => ($app.characters.magicItems = !$app.characters.magicItems)}
					on:keypress={() => null}
					on:keypress
					aria-label="Toggle Magic Items"
					tabindex="0"
				>
					<Icon src={$app.characters.magicItems ? "show" : "hide"} class="w-6" />
				</button>
			</div>
			<div class="flex gap-2">
				{#if $app.characters.display != "grid"}
					<button
						class={twMerge("btn hidden sm:btn-sm xs:inline-flex", $app.characters.magicItems && "btn-primary")}
						on:click={() => createTransition(() => ($app.characters.magicItems = !$app.characters.magicItems))}
						on:keypress={() => null}
						on:keypress
						aria-label="Toggle Magic Items"
						tabindex="0"
					>
						<Icon src={$app.characters.magicItems ? "show" : "hide"} class="w-6" />
						<span class="hidden xs:inline-flex sm:hidden md:inline-flex">Magic Items</span>
					</button>
				{/if}
				<div class="no-script-hide join hidden xs:flex">
					<button
						class={twMerge("btn join-item sm:btn-sm", $app.characters.display == "list" ? "btn-primary" : "hover:btn-primary")}
						on:click={() => createTransition(() => ($app.characters.display = "list"))}
						on:keypress
						aria-label="List View"
					>
						<Icon src="format-list-text" class="w-4" />
					</button>
					<button
						class={twMerge("btn join-item sm:btn-sm", $app.characters.display == "grid" ? "btn-primary" : "hover:btn-primary")}
						on:click={() => createTransition(() => ($app.characters.display = "grid"))}
						on:keypress
						aria-label="Grid View"
					>
						<Icon src="view-grid" class="w-4" />
					</button>
				</div>
			</div>
		</div>

		<div>
			<div class={twMerge("w-full overflow-x-auto rounded-lg", $app.characters.display == "grid" && "block xs:hidden")}>
				<div
					class={twMerge(
						"grid-table",
						data.mobile ? "grid-characters-mobile sm:grid-characters-mobile-sm" : "grid-characters-mobile sm:grid-characters"
					)}
				>
					<header class="!hidden sm:!contents">
						{#if !data.mobile}
							<div class="hidden sm:block" />
						{/if}
						<div>Name</div>
						<div>Campaign</div>
						<div class="text-center">Tier</div>
						<div class="text-center">Level</div>
					</header>
					{#each results as character}
						<a href={`/characters/${character.id}`} class="img-grow">
							{#if !data.mobile}
								<div class="hidden pr-0 transition-colors sm:block sm:pr-2">
									<div class="avatar">
										<div class="mask mask-squircle size-12 bg-primary" use:transition={slugify("image-" + character.id)}>
											{#if character.image_url}
												{#key character.image_url}
													<img
														src={character.image_url}
														width={48}
														height={48}
														class="size-full object-cover object-top"
														alt={character.name}
														loading="lazy"
													/>
												{/key}
											{:else}
												<Icon src="account" class="w-12" />
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
							$app.characters.display == "grid" && "hidden xs:block",
							tier > 1 && "pt-6"
						)}
					>
						Tier {tier}
					</h1>
					<div
						class={twMerge(
							"w-full",
							$app.characters.display == "list" && "hidden",
							$app.characters.display == "grid" && "hidden grid-cols-2 gap-4 xs:grid sm:grid-cols-3 md:grid-cols-4"
						)}
					>
						{#each results.filter((c) => c.tier == tier) as character}
							{@const miMatches = msResults.find(
								(result) => result.id == character.id && result.terms.find((term) => result.match[term].includes("magicItems"))
							)}
							<a
								href={`/characters/${character.id}`}
								class="card card-compact bg-base-100 shadow-xl transition-transform duration-200 motion-safe:hover:scale-105"
								use:transition={slugify("image-" + character.id)}
							>
								<figure class="relative aspect-square overflow-hidden">
									{#key character.image_url}
										<img
											src={character.image_url}
											alt={character.name}
											class="size-full object-cover object-top"
											loading="lazy"
										/>
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
