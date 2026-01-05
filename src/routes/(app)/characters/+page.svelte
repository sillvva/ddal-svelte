<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Head from "$lib/components/head.svelte";
	import Items from "$lib/components/items.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import SearchResults from "$lib/components/search-results.svelte";
	import Search from "$lib/components/search.svelte";
	import { EntitySearchFactory } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { createTransition, download, hotkey } from "$lib/util";
	import { sorter } from "@sillvva/utils";
	import { untrack } from "svelte";

	const global = getGlobal();
</script>

<svelte:boundary>
	{@const { user } = await API.app.queries.request()}
	{@const characters = await API.characters.queries.getAll()}
	{@const search = new EntitySearchFactory(
		characters,
		untrack(() => page.url.searchParams.get("s") || "")
	)}
	{@const sortedResults = search.results.toSorted(
		(a, b) => sorter(b.score, a.score) || sorter(a.totalLevel, b.totalLevel) || sorter(a.name, b.name)
	)}

	<Head title="{user?.name}'s Characters" />

	<NavMenu base crumbs={[{ title: "Characters", url: "/characters" }]}>
		{#snippet menu()}
			<li role="menuitem">
				<button
					{@attach download(() => ({
						filename: "characters.json",
						blob: new Blob([JSON.stringify(characters)])
					}))}
				>
					Export
				</button>
			</li>
		{/snippet}
	</NavMenu>

	{#if !characters.length}
		<section class="bg-base-200 rounded-lg">
			<div class="py-20 text-center">
				<p class="mb-4">No characters found.</p>
				<p>
					<a href="/characters/new/edit" class="btn btn-primary">Create your first character</a>
				</p>
			</div>
		</section>
	{:else}
		<div class="flex flex-wrap justify-between gap-2">
			<div class="flex gap-2 max-sm:w-full sm:max-md:flex-1 md:w-md">
				<a
					href="/characters/new/edit"
					class="btn btn-primary btn-sm max-sm:hidden"
					{@attach hotkey([
						[
							"n",
							() => {
								goto(`/characters/new/edit`);
							}
						]
					])}
				>
					New <span class="max-md:hidden">Character</span>
					<kbd class="kbd kbd-sm max-md:hover-none:hidden text-base-content">N</kbd>
				</a>
				<Search bind:value={search.query} placeholder="Search by name, class, items, etc." />
				<a href="/characters/new/edit" class="btn btn-primary sm:hidden" aria-label="New Character">
					<span class="iconify mdi--plus inline size-6"></span>
				</a>
				<button
					class="btn data-[enabled=true]:btn-primary xs:hidden inline-flex"
					data-enabled={global.app.characters.magicItems}
					onclick={() => {
						global.app.characters.magicItems = !global.app.characters.magicItems;
					}}
					onkeypress={() => null}
					aria-label="Toggle Magic Items"
					tabindex="0"
				>
					{#if global.app.characters.magicItems}
						<span class="iconify mdi--shield-sword size-6"></span>
					{:else}
						<span class="iconify mdi--shield-sword-outline size-6"></span>
					{/if}
				</button>
			</div>
			<div class="flex justify-end gap-2 max-sm:mb-2 max-sm:w-full">
				{#if global.app.characters.display != "grid"}
					<button
						class="btn data-[enabled=true]:btn-primary sm:btn-sm max-xs:hidden"
						data-enabled={global.app.characters.magicItems}
						onclick={() =>
							createTransition(async () => {
								global.app.characters.magicItems = !global.app.characters.magicItems;
							})}
						onkeypress={() => null}
						aria-label="Toggle Magic Items"
						tabindex="0"
					>
						{#if global.app.characters.magicItems}
							<span class="iconify mdi--eye max-xs:hidden size-5 sm:max-md:hidden"></span>
							<span class="iconify mdi--shield-sword xs:max-sm:hidden size-6 md:hidden"></span>
						{:else}
							<span class="iconify mdi--eye-off max-xs:hidden size-5 sm:max-md:hidden"></span>
							<span class="iconify mdi--shield-sword-outline xs:max-sm:hidden size-6 md:hidden"></span>
						{/if}
						<span class="max-xs:hidden sm:max-md:hidden">Magic Items</span>
					</button>
				{/if}
				<div class="join max-xs:hidden">
					<button
						class="btn join-item data-[display=list]:btn-primary data-[display=grid]:hover:btn-primary sm:btn-sm"
						data-display={global.app.characters.display}
						onclick={() =>
							createTransition(() => {
								global.app.characters.display = "list";
							})}
						onkeypress={() => null}
						aria-label="List View"
					>
						<span class="iconify mdi--format-list-text size-4"></span>
					</button>
					<button
						class="btn join-item data-[display=grid]:btn-primary data-[display=list]:hover:btn-primary sm:btn-sm"
						data-display={global.app.characters.display}
						onclick={() =>
							createTransition(() => {
								global.app.characters.display = "grid";
							})}
						onkeypress={() => null}
						aria-label="Grid View"
					>
						<span class="iconify mdi--view-grid size-4"></span>
					</button>
				</div>
			</div>
		</div>

		<div class="max-sm:-mt-4">
			<div
				class="xs:data-[display=grid]:hidden w-full overflow-x-auto rounded-lg data-[display=grid]:block"
				data-display={global.app.characters.display}
			>
				<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
					<thead class="max-md:hidden">
						<tr class="bg-base-300 text-base-content/70">
							<td class="w-18"></td>
							<td>Characters ({sortedResults.length})</td>
							<td>Campaign</td>
							<td class="text-center">Tier</td>
							<td class="text-center">Level</td>
						</tr>
					</thead>
					<tbody>
						{#each sortedResults as character (character.id)}
							<tr class="group/row">
								<td class="pr-0 align-top transition-colors sm:pr-2">
									<div class="avatar">
										<div class="mask mask-squircle bg-primary size-12" style:view-transition-name={"image-" + character.id}>
											{#if character.imageUrl}
												{#key character.imageUrl}
													<img
														src={character.imageUrl}
														width={48}
														height={48}
														class="size-full object-cover object-top duration-150 ease-in-out group-hover/row:scale-125 motion-safe:transition-transform"
														alt={character.name}
														loading="lazy"
													/>
												{/key}
											{:else}
												<span class="iconify mdi--account size-12"></span>
											{/if}
										</div>
									</div>
								</td>
								<td>
									<div class="text-base font-bold whitespace-pre-wrap text-black sm:text-xl dark:text-white">
										<a href={`/characters/${character.id}`} aria-label={character.name} class="row-link">
											<SearchResults text={character.name} terms={search.terms} />
										</a>
									</div>
									<div class="text-xs whitespace-pre-wrap sm:text-sm">
										<span class="inline pr-1 md:hidden">Level {character.totalLevel}</span><SearchResults
											text={character.race}
											terms={search.terms}
										/>
										<SearchResults text={character.class} terms={search.terms} />
									</div>
									<div class="mb-2 text-xs md:hidden">
										<SearchResults text={character.campaign} terms={search.terms} />
									</div>
									{#if (character.match.has("magicItems") || global.app.characters.magicItems) && character.magicItems.length}
										<div class="my-2">
											<Items
												title="Magic Items"
												items={character.magicItems}
												terms={search.terms}
												filtered
												matches={character.match.size}
												formatting
											/>
										</div>
									{/if}
									{#if character.match.has("storyAwards") && character.storyAwards.length}
										<div class="mb-2">
											<Items
												type="Story Awards"
												items={character.storyAwards}
												terms={search.terms}
												filtered
												matches={character.match.size}
											/>
										</div>
									{/if}
									{#if search.terms.length > 0}
										<div class="mb-2">
											Search Score: {Math.round(character.score * 100) / 100}
										</div>
									{/if}
								</td>
								<td class="transition-colors max-md:hidden">
									<SearchResults text={character.campaign} terms={search.terms} />
								</td>
								<td class="text-center transition-colors max-md:hidden">
									{character.tier}
								</td>
								<td class="text-center transition-colors max-md:hidden">
									{character.totalLevel}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#snippet grid(results: typeof sortedResults)}
				<div
					class="xs:data-[display=grid]:grid hidden w-full grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4"
					data-display={global.app.characters.display}
				>
					{#each results as character (character.id)}
						<div
							class="card linked-card card-compact bg-base-200 row-span-4 grid grid-rows-subgrid gap-1 pb-3 text-center shadow-xl transition-transform duration-200 motion-safe:hover:scale-105"
							style:view-transition-name={"image-" + character.id}
						>
							<figure class="relative mb-2 aspect-square overflow-hidden">
								{#key character.imageUrl}
									<img src={character.imageUrl} alt={character.name} class="size-full object-cover object-top" loading="lazy" />
								{/key}
								{#if search.query.length >= 1 && character.match.has("magicItems")}
									<div class="absolute inset-0 flex items-center bg-black/50 p-2 text-center text-xs text-white">
										<div class="flex-1">
											<Items
												type="Magic Items"
												items={character.magicItems}
												terms={search.terms}
												filtered
												matches={character.match.size}
												formatting
											/>
										</div>
									</div>
								{/if}
							</figure>
							<h2 class="card-title ellipsis-nowrap block px-4 text-sm text-balance dark:text-white">
								<a href={`/characters/${character.id}`} class="card-link">
									<SearchResults text={character.name} terms={search.terms} />
								</a>
							</h2>
							<p class="px-4 text-xs text-balance">
								<SearchResults text={`${character.race} ${character.class}`} terms={search.terms} />
							</p>
							<p class="text-xs">
								Level {character.totalLevel} | Tier {character.tier}
								{#if search.terms.length}| Score {Math.round(character.score * 100) / 100}{/if}
							</p>
						</div>
					{/each}
				</div>
			{/snippet}

			{#if search.terms.length}
				{@render grid(sortedResults)}
			{:else}
				{#each [...new Set(sortedResults.map((c) => c.tier))].sort(sorter) as tier, index (tier)}
					<h1
						class="font-vecna max-xs:data-[display=grid]:hidden pt-6 pb-2 text-3xl font-bold data-[display=list]:hidden data-[index=0]:pt-0 dark:text-white"
						data-display={global.app.characters.display}
						data-index={index}
					>
						Tier {tier}
					</h1>
					{@render grid(sortedResults.filter((c) => c.tier == tier))}
				{/each}
			{/if}
		</div>
	{/if}
</svelte:boundary>
