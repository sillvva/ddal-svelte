<script lang="ts">
	import SearchResults from "$src/components/SearchResults.svelte";
	import type { PageData } from "./$types";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";
	import { setCookie } from "$src/server/cookie";

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
						acc.push(
							...log.magic_items_gained.filter((magicItem) => !magicItem.logLostId).map((magicItem) => magicItem.name)
						);
						return acc;
					}, [] as string[])
					.join(", ")
		  }))
		: [];

	minisearch.addAll(indexed);

	let search = "";

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

	$: {
		setCookie("characters:magicItems", magicItems);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex gap-4">
		<div class="breadcrumbs text-sm">
			<ul>
				<li>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
						><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
					>
				</li>
				<li class="dark:drop-shadow-md">Characters</li>
			</ul>
		</div>
		<div class="flex-1" />
		{#if characters.length > 0}
			<a href="/characters/new/edit" class="btn-primary btn-sm btn">
				<span class="hidden sm:inline">New Character</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="inline w-4 sm:hidden"
					><title>plus</title><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" /></svg
				>
			</a>
		{/if}
		<div class="dropdown-end dropdown">
			<span tabIndex={1} class="btn-sm btn">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
					><title>dots-horizontal</title><path
						fill="currentColor"
						d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
					/></svg
				>
			</span>
			<ul tabIndex={1} class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
				<li>
					<a
						download={`characters.json`}
						href={`/api/exports/characters/all`}
						target="_blank"
						rel="noreferrer noopener"
					>
						Export
					</a>
				</li>
			</ul>
		</div>
	</div>

	<div class="flex gap-4">
		<input
			type="text"
			placeholder="Search by name, race, class, items, etc."
			bind:value={search}
			class="input-bordered input input-sm w-full max-w-xs"
		/>
		<div class="form-control">
			<label class="label cursor-pointer py-1">
				<span class="label-text hidden pr-4 sm:inline">Items</span>
				<input type="checkbox" class="toggle-primary toggle" bind:checked={magicItems} />
			</label>
		</div>
	</div>

	<div class="w-full overflow-x-auto rounded-lg">
		<div class={twMerge("grid-table", characters.length && "grid-characters-mobile sm:grid-characters")}>
			<header>
				<div />
				<div>Name</div>
				<div class="hidden sm:block">Campaign</div>
				<div class="hidden sm:block text-center">Tier</div>
				<div class="hidden sm:block text-center">Level</div>
			</header>
			{#if !characters.length}
				<section class="bg-base-100">
					<div class="py-20 text-center">
						<p class="mb-4">You have no log sheets.</p>
						<p>
							<a href="/characters/new" class="btn-primary btn"> Create one now </a>
						</p>
					</div>
				</section>
			{:else}
				{#each results as character}
					<a href={`/characters/${character.id}`} class="img-grow">
						<div class="pr-0 transition-colors sm:pr-2">
							<div class="avatar">
								<div class="mask mask-squircle h-12 w-12 bg-primary">
									<img
										src={character.image_url || ""}
										width={48}
										height={48}
										class="h-full w-full object-cover object-top transition-all hover:scale-125"
										alt={character.name}
									/>
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
</div>
