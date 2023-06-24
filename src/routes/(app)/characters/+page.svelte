<script lang="ts">
	import Meta from "$lib/components/Meta.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import Icon from "$src/lib/components/Icon.svelte";
	import { setCookie } from "$src/server/cookie";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";
	import type { PageData } from "./$types";

	export let data: PageData;

	let stopWords = new Set(["and", "or", "to", "in", "a", "the"]);
	const minisearch = new MiniSearch({
		fields: ["characterName", "campaign", "race", "class", "magicItems", "tier", "level"],
		idField: "characterId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		searchOptions: {
			prefix: true
		}
	});

	let characters = data.characters;
	let indexed = characters
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

	let search = "";
	minisearch.addAll(indexed);
	$: msResults = minisearch.search(search);
	$: results =
		indexed.length && search.length > 1
			? characters
					.filter((character) => msResults.find((result) => result.id === character.id))
					.map((character) => ({
						...character,
						score: msResults.find((result) => result.id === character.id)?.score || character.name,
						match: Object.entries(msResults.find((result) => result.id === character.id)?.match || {})
							.map(([, value]) => value[0] || "")
							.filter((v) => !!v)
					}))
					.sort((a, b) => a.total_level - b.total_level || a.name.localeCompare(b.name))
			: characters
					.sort((a, b) => a.total_level - b.total_level || a.name.localeCompare(b.name))
					.map((character) => ({ ...character, score: 0, match: [] }));

	let magicItems = data.magicItems;
	let display = data.display;
	$: setCookie("characters:magicItems", magicItems);
	$: setCookie("characters:display", display);
</script>

<Meta title="{data.session?.user?.name}'s Characters" />

<div class="flex flex-col gap-4">
	<div class="flex gap-4">
		<div class="breadcrumbs text-sm">
			<ul>
				<li>
					<Icon src="home" class="w-4" />
				</li>
				<li class="dark:drop-shadow-md">Characters</li>
			</ul>
		</div>
		<div class="flex-1" />
		{#if characters.length > 0}
			<a href="/characters/new/edit" class="btn-primary btn-sm btn" aria-label="New Character">
				<span class="hidden xs:inline">New Character</span>
				<Icon src="plus" class="inline w-4 sm:hidden" />
			</a>
		{/if}
		<div class="dropdown-end dropdown">
			<span role="button" tabindex="0" class="btn-sm btn">
				<Icon src="dots-horizontal" class="w-6" />
			</span>
			<ul class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
				<li>
					<a download={`characters.json`} href={`/api/export/characters/all`} target="_blank" rel="noreferrer noopener">Export</a>
				</li>
			</ul>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		<input
			type="text"
			placeholder="Search by name, race, class, items, etc."
			bind:value={search}
			class="input-bordered input input-sm w-full sm:max-w-xs"
		/>
		<div class="flex-1" />
		<div class={twMerge("form-control", display == "grid" && "block sm:hidden")}>
			<label class="label cursor-pointer py-1">
				<span class="label-text pr-4">Show Items</span>
				<input type="checkbox" class="toggle-primary toggle" bind:checked={magicItems} />
			</label>
		</div>
		<div class="join hidden xs:flex">
			<button
				class={twMerge("btn-sm join-item btn hover:btn-primary", display == "list" && "bg-primary")}
				on:click={() => (display = "list")}
				on:keypress
				aria-label="List View"
			>
				<Icon src="format-list-text" class="w-4" />
			</button>
			<button
				class={twMerge("btn-sm join-item btn hover:btn-primary", display == "grid" && "bg-primary")}
				on:click={() => (display = "grid")}
				on:keypress
				aria-label="Grid View"
			>
				<Icon src="view-grid" class="w-4" />
			</button>
		</div>
	</div>

	<div class={twMerge("w-full overflow-x-auto rounded-lg", display == "grid" && "block xs:hidden")}>
		<div class={twMerge("grid-table", characters.length && "grid-characters-mobile sm:grid-characters")}>
			<header class="!hidden sm:!contents">
				<div />
				<div>Name</div>
				<div>Campaign</div>
				<div class="text-center">Tier</div>
				<div class="text-center">Level</div>
			</header>
			{#if !characters.length}
				<section class="bg-base-100">
					<div class="py-20 text-center">
						<p class="mb-4">You have no log sheets.</p>
						<p>
							<a href="/characters/new" class="btn-primary btn">Create one now</a>
						</p>
					</div>
				</section>
			{:else}
				{#each results as character}
					<a href={`/characters/${character.id}`} class="img-grow">
						<div class="pr-0 transition-colors sm:pr-2">
							<div class="avatar">
								<div class="mask mask-squircle h-12 w-12 bg-primary">
									{#if character.image_url}
										<img
											src={character.image_url}
											width={48}
											height={48}
											class="h-full w-full object-cover object-top transition-all hover:scale-125"
											alt={character.name}
										/>
									{:else}
										<Icon src="account" class="w-12" />
									{/if}
								</div>
							</div>
						</div>
						<div>
							<div class="whitespace-pre-wrap text-base font-bold text-accent-content sm:text-xl">
								<SearchResults text={character.name} {search} />
							</div>
							<div class="whitespace-pre-wrap text-xs sm:text-sm">
								<span class="inline pr-1 sm:hidden">Level {character.total_level}</span><SearchResults
									text={character.race}
									{search}
								/>
								<SearchResults text={character.class} {search} />
							</div>
							<div class="mb-2 block text-xs sm:hidden">
								<p>
									<SearchResults text={character.campaign} {search} />
								</p>
							</div>
							{#if (character.match.includes("magicItems") || magicItems) && character.magic_items.length}
								<div class="mb-2">
									<p class="font-semibold">Magic Items:</p>
									<SearchResults text={character.magic_items.map((item) => item.name).join(" | ")} {search} />
								</div>
							{/if}
						</div>
						<div class="hidden transition-colors sm:flex">
							<SearchResults text={character.campaign} {search} />
						</div>
						<div class="hidden justify-center transition-colors sm:flex">{character.tier}</div>
						<div class="hidden justify-center transition-colors sm:flex">{character.total_level}</div>
					</a>
				{/each}
			{/if}
		</div>
	</div>

	{#if !characters.length}
		<section class="bg-base-100">
			<div class="py-20 text-center">
				<p class="mb-4">You have no log sheets.</p>
				<p>
					<a href="/characters/new" class="btn-primary btn">Create one now</a>
				</p>
			</div>
		</section>
	{:else}
		{#each [1, 2, 3, 4] as tier}
			{#if results.filter((c) => c.tier == tier).length}
				<h1
					class={twMerge(
						"text-2xl font-bold dark:text-white",
						display == "list" && "hidden",
						display == "grid" && "hidden xs:block"
					)}
				>
					Tier {tier}
				</h1>
				<div
					class={twMerge(
						"w-full",
						display == "list" && "hidden",
						display == "grid" && "hidden grid-cols-2 gap-4 xs:grid sm:grid-cols-3 md:grid-cols-4"
					)}
				>
					{#each results.filter((c) => c.tier == tier) as character}
						<a href={`/characters/${character.id}`} class="img-grow card card-compact bg-base-100 shadow-xl">
							<figure class="aspect-square overflow-hidden">
								<img src={character.image_url} alt={character.name} class="h-full w-full object-cover object-top" />
							</figure>
							<div class="card-body">
								<div class="flex flex-col gap-1">
									<h2 class="card-title block overflow-hidden text-ellipsis whitespace-nowrap text-sm dark:text-white">
										<SearchResults text={character.name} {search} />
									</h2>
									<p class="text-xs"><SearchResults text={`${character.race} ${character.class}`} {search} /></p>
									<p class="text-xs">Level {character.total_level} | Tier {character.tier}</p>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/each}
	{/if}
</div>