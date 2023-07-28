<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { sorter, stopWords } from "$lib/utils";
	import { lazy } from "$src/lib/actions.js";
	import { setCookie } from "$src/server/cookie";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";

	export let data;

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
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
			: characters
					.sort((a, b) => sorter(a.total_level, b.total_level) || sorter(a.name, b.name))
					.map((character) => ({ ...character, score: 0, match: [] }));

	let magicItems = data.magicItems;
	let display = data.display;
	$: setCookie("characters:magicItems", magicItems);
	$: setCookie("characters:display", display);
</script>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex">
		<BreadCrumbs />

		<div class="dropdown-end dropdown">
			<span role="button" tabindex="0" class="btn-sm btn bg-base-100">
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
		<div class="flex w-full gap-2 sm:max-w-md">
			{#if characters.length > 0}
				<a href="/characters/new/edit" class="btn-primary btn-sm btn hidden sm:inline-flex" aria-label="New Character">
					New Character
				</a>
				<input
					type="text"
					placeholder="Search by name, race, class, items, etc."
					bind:value={search}
					class="input-bordered input flex-1 sm:input-sm"
				/>
				<a href="/characters/new/edit" class="btn-primary btn inline-flex sm:hidden" aria-label="New Character">
					<Icon src="plus" class="inline w-6" />
				</a>
				<btn
					class={twMerge("btn inline-flex xs:hidden", magicItems && "btn-primary")}
					on:click={() => (magicItems = !magicItems)}
					on:keypress={() => null}
					on:keypress
					role="button"
					aria-label="Toggle Magic Items"
					tabindex="0"
				>
					<Icon src={magicItems ? "show" : "hide"} class="w-6" />
				</btn>
			{/if}
		</div>
		<div class="hidden flex-1 xs:block" />
		{#if display != "grid"}
			<btn
				class={twMerge("btn hidden sm:btn-sm xs:inline-flex", magicItems && "btn-primary")}
				on:click={() => (magicItems = !magicItems)}
				on:keypress={() => null}
				on:keypress
				role="button"
				aria-label="Toggle Magic Items"
				tabindex="0"
			>
				<Icon src={magicItems ? "show" : "hide"} class="w-6" />
				<span class="hidden xs:inline-flex sm:hidden md:inline-flex">Magic Items</span>
			</btn>
		{/if}
		<div class="join hidden xs:flex">
			<button
				class={twMerge("join-item btn sm:btn-sm", display == "list" ? "btn-primary" : "hover:btn-primary")}
				on:click={() => (display = "list")}
				on:keypress
				aria-label="List View"
			>
				<Icon src="format-list-text" class="w-4" />
			</button>
			<button
				class={twMerge("join-item btn sm:btn-sm", display == "grid" ? "btn-primary" : "hover:btn-primary")}
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
				{#if !data.mobile}
					<div />
				{/if}
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
						{#if !data.mobile}
							<div class="pr-0 transition-colors sm:pr-2">
								<div class="avatar">
									<div class="mask mask-squircle h-12 w-12 bg-primary">
										{#if character.image_url}
											<img
												data-src={character.image_url}
												width={48}
												height={48}
												class="h-full w-full object-cover object-top transition-all hover:scale-125"
												alt={character.name}
												use:lazy={{ rootMargin: "100px" }}
											/>
										{:else}
											<Icon src="account" class="w-12" />
										{/if}
									</div>
								</div>
							</div>
						{/if}
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
									<SearchResults
										text={character.magic_items.map((item) => item.name)}
										{search}
										msResult={msResults.find((result) => result.id === character.id)}
									/>
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
						{@const miMatches = msResults.find(
							(result) => result.id == character.id && result.terms.find((term) => result.match[term].includes("magicItems"))
						)}
						<a href={`/characters/${character.id}`} class="img-grow card card-compact bg-base-100 shadow-xl">
							<figure class="relative aspect-square overflow-hidden">
								<img
									data-src={character.image_url}
									alt={character.name}
									class="h-full w-full object-cover object-top"
									use:lazy={{ rootMargin: "100px" }}
								/>
								{#if search.length >= 1 && indexed.length && miMatches}
									<div class="absolute inset-0 flex items-center bg-black/50 p-2 text-center text-xs text-white">
										<div class="flex-1">
											<SearchResults
												text={character.magic_items.map((item) => item.name)}
												{search}
												msResult={msResults.find((result) => result.id === character.id)}
												filtered
											/>
										</div>
									</div>
								{/if}
							</figure>
							<div class="card-body text-center">
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
