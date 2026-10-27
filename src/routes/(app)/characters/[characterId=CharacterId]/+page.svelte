<script lang="ts">
	import { authClient } from "#lib/auth.js";
	import Error from "#lib/components/error.svelte";
	import Head from "#lib/components/head.svelte";
	import Items from "#lib/components/items.svelte";
	import Markdown from "#lib/components/markdown.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import SearchResults from "#lib/components/search-results.svelte";
	import Search from "#lib/components/search.svelte";
	import { EntitySearchFactory, successToast, swipeAction } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { FullCharacterData } from "#lib/server/effect/services/characters.js";
	import type { FullLogData } from "#lib/server/effect/services/logs.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { createTransition, formatDate, hotkey, parseEffectResult } from "#lib/util.js";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { slugify, sorter } from "@sillvva/utils";
	import { clipboard, download } from "@svelteuidev/composables";
	import { onMount } from "svelte";
	import { fromAction } from "svelte/attachments";
	import { SvelteSet } from "svelte/reactivity";

	const { params } = $props();

	const global = getGlobal();

	let deletingLog = new SvelteSet<string>();
	const searchKey = "s";

	const queryParams = $derived({ param: params.characterId, newRedirect: true });

	async function triggerImageModal(character: FullCharacterData, image?: string) {
		const imageUrl = image || character.imageUrl;

		goto("", {
			shallow: true,
			state: { modal: { type: "image", name: character.name, imageUrl } }
		});
	}

	function scroller(search: EntitySearchFactory<FullCharacterData["logs"]>) {
		return function scrollToSearch(searchBar: HTMLDivElement) {
			if (search.query.trim()) scrollTo({ top: searchBar.offsetTop - 16, behavior: "smooth" });
		};
	}

	async function deleteLog(log: FullLogData) {
		if (!confirm(`Are you sure you want to delete ${log.name}? This action cannot be undone.`)) return;
		deletingLog.add(log.id);
		const result = await API.logs.actions.deleteLog(log.id);
		const parsed = await parseEffectResult(result);
		if (parsed) {
			successToast(`${log.name} deleted`);
			await API.characters.queries.get(queryParams).refresh();
		} else {
			deletingLog.delete(log.id);
		}
	}

	onMount(async () => {
		const { user } = await API.app.queries.request();
		if (global.app.settings.autoWebAuthn && !user) {
			authClient.signIn.passkey({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = page.url.pathname;
					}
				}
			});
		}
	});
</script>

<svelte:boundary>
	{const { user } = $derived(await API.app.queries.request())}
	{const character = $derived(await API.characters.queries.get(queryParams))}
	{const myCharacter = $derived(character.userId === user?.id)}
	{const search = $derived(
		new EntitySearchFactory(character.logs, page.url.searchParams.get(searchKey) ?? page.state.search?.[searchKey] ?? "")
	)}
	{const sortedResults = $derived(search.results.toSorted((a, b) => sorter(a.showDate, b.showDate)))}

	{#snippet failed(error)}
		<Error {error} boundary="[characterId=CharacterId]/+page.svelte" />
	{/snippet}

	<Head
		title={character.name}
		description={`Level ${character.totalLevel} ${character.race} ${character.class}`}
		image={`${page.url.origin}/characters/${character.id}/og-image.jpg`}
	/>

	{#if user}
		<NavMenu
			hideMenuActions={!myCharacter}
			crumbs={[
				{ title: "Characters", url: "/characters" },
				{ title: character.name, url: `/characters/${character.id}` }
			]}
		>
			{#snippet actions()}
				<a href={`/characters/${character.id}/edit`} class="btn h-9 btn-primary btn-sm max-sm:hidden">Edit</a>
				<button
					aria-label="Share Character"
					class="btn h-9 btn-sm max-sm:hidden"
					onclick={() => successToast("Character URL copied to clipboard")}
					{@attach fromAction(clipboard, () => page.url.href)}
				>
					<span class="iconify size-4 mdi--share-variant"></span>
				</button>
			{/snippet}
			{#snippet menu()}
				<li role="menuitem" class="sm:hidden"><a href={`/characters/${character.id}/edit`}>Edit</a></li>
				<li role="menuitem" class="sm:hidden">
					<button
						onclick={() => successToast("Character URL copied to clipboard")}
						{@attach fromAction(clipboard, () => page.url.href)}
					>
						Copy Character URL
					</button>
				</li>
				<li role="menuitem" class="max-sm:hidden">
					<button
						{@attach fromAction(download, () => ({
							filename: `${slugify(character.name)}.json`,
							blob: new Blob([JSON.stringify(character)])
						}))}>Export</button
					>
				</li>
				{#if character.imageUrl}
					<li role="menuitem" class="xs:hidden">
						<a
							href={character.imageUrl}
							target="_blank"
							onclick={(e) => {
								e.preventDefault();
								triggerImageModal(character);
							}}>Character Image</a
						>
					</li>
				{/if}
				<li role="menuitem">
					<a
						href={`/characters/${character.id}/og-image.jpg`}
						target="_blank"
						onclick={(e) => {
							e.preventDefault();
							triggerImageModal(character, `/characters/${character.id}/og-image.jpg`);
						}}>Social Media Image</a
					>
				</li>
				<li role="menuitem">
					<button
						type="button"
						class="hover:bg-error"
						aria-label="Delete Character"
						disabled={!!API.characters.actions.deleteCharacter.pending}
						onclick={async () => {
							if (!confirm(`Are you sure you want to delete ${character.name}? This action cannot be undone.`)) return;

							const dmLogs = character.logs
								.filter((log) => log.isDmLog)
								.map((log) => {
									const date = formatDate(new Date(log.showDate), log.timezone);
									return `‣ [${date}] ${log.name}`;
								});
							if (dmLogs.length > 0)
								alert(`${dmLogs.length} DM logs will be unassigned from this character:\n\n${dmLogs.join("\n")}`);

							global.pageLoader = true;
							const result = await API.characters.actions.deleteCharacter(character.id);
							const parsed = await parseEffectResult(result);
							if (parsed) {
								successToast(`${character.name} deleted`);
								await goto("/characters");
							}
							global.pageLoader = false;
						}}
					>
						Delete Character
					</button>
				</li>
			{/snippet}
		</NavMenu>
	{/if}

	<section class="flex">
		<div class="flex flex-1 flex-col gap-6">
			<div class="flex">
				{#if character.imageUrl}
					<div class="relative mr-4 hidden w-20 flex-col items-end justify-center xs:max-md:flex print:hidden">
						<a
							href={character.imageUrl}
							target="_blank"
							rel="noreferrer noopener"
							class="mx-auto mask h-20 bg-primary mask-squircle"
							style:view-transition-name={"image-" + character.id}
							onclick={(e) => {
								e.preventDefault();
								triggerImageModal(character);
							}}
						>
							<img src={character.imageUrl} class="size-full object-cover object-top transition-all" alt={character.name} />
						</a>
					</div>
				{/if}
				<div class="flex w-full flex-col">
					<div class="mb-2 flex gap-4 xs:mb-0">
						<h2
							class="flex-1 py-2 font-vecna text-3xl font-bold text-black sm:py-0 sm:text-4xl dark:text-white print:text-2xl print:text-base-content"
						>
							{character.name}
						</h2>
					</div>
					<p class="flex-1 text-sm font-semibold">
						{character.race}
						{character.class}
					</p>
					<p class="flex-1 text-sm">
						{character.campaign}
						{#if character.characterSheetUrl}
							<span class="print:hidden">
								-
								<a
									href={character.characterSheetUrl}
									target="_blank"
									rel="noreferrer noopner"
									class="font-semibold text-secondary-content dark:not-print:drop-shadow-xs"
								>
									Character Sheet
								</a>
							</span>
						{/if}
					</p>
					{#if character.user?.id !== user?.id}
						<p class="flex-1 text-sm">
							<span class="font-semibold dark:text-white">Player:</span>
							{character.user?.name}
						</p>
					{/if}
				</div>
			</div>
			<div class="flex flex-1 flex-wrap gap-4 xs:flex-nowrap sm:gap-4 md:gap-6 print:flex-nowrap print:gap-2">
				<div class="flex basis-full flex-col gap-2 xs:basis-[40%] sm:basis-1/3 sm:gap-4 md:basis-52 print:basis-1/3 print:gap-2">
					{#if character.imageUrl}
						<div class="relative flex flex-col items-end justify-center max-md:hidden print:hidden">
							<a
								href={character.imageUrl}
								target="_blank"
								rel="noreferrer noopener"
								class="mx-auto mask h-52 w-full bg-primary mask-squircle"
								style:view-transition-name={"image-" + character.id}
								onclick={(e) => {
									e.preventDefault();
									triggerImageModal(character);
								}}
							>
								<img src={character.imageUrl} class="size-full object-cover object-top transition-all" alt={character.name} />
							</a>
						</div>
					{/if}
					<div class="flex">
						<h4 class="font-semibold dark:text-white print:text-base-content">Level</h4>
						<div class="flex-1 text-right">{character.totalLevel}</div>
					</div>
					<div class="flex">
						<h4 class="font-semibold dark:text-white print:text-base-content">Tier</h4>
						<div class="flex-1 text-right">{character.tier}</div>
					</div>
					<div class="flex">
						<h4 class="font-semibold dark:text-white print:text-base-content">Gold</h4>
						<div class="flex-1 text-right">{character.totalGold.toLocaleString()}</div>
					</div>
					{#if character.totalTcp}
						<div class="flex">
							<h4 class="font-semibold dark:text-white print:text-base-content">TCP</h4>
							<div class="flex-1 text-right">{character.totalTcp}</div>
						</div>
					{/if}
					<div class="flex">
						<h4 class="font-semibold dark:text-white print:text-base-content">Downtime</h4>
						<div class="flex-1 text-right">{character.totalDtd}</div>
					</div>
				</div>
				<div
					class={[
						"divider max-xs:hidden xs:mx-0 xs:divider-horizontal print:flex",
						"before:bg-black/50 after:bg-black/50 dark:before:bg-white/50 dark:after:bg-white/50"
					]}
				></div>
				<div class="flex basis-full flex-col xs:basis-[60%] sm:basis-2/3 lg:basis-2/3 print:basis-2/3">
					{#if character}
						<div class="flex flex-col gap-4">
							<svelte:boundary>
								{#snippet failed(error)}
									<Error {error} boundary="Story Awards and Magic Items" />
								{/snippet}
								<Items title="Story Awards" items={character.storyAwards} collapsible sort search />
								<Items title="Magic Items" items={character.magicItems} collapsible formatting sort search />
							</svelte:boundary>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	{#if character.logs.length}
		<div class="mt-4 flex flex-wrap gap-2 print:hidden" {@attach scroller(search)}>
			<div class="flex w-full gap-2 sm:max-w-md print:hidden">
				{#if myCharacter}
					<a
						href={`/characters/${character.id}/log/new`}
						class="btn btn-primary max-sm:hidden sm:px-3 sm:btn-sm"
						aria-label="New Log"
						{@attach hotkey([
							[
								"n",
								() => {
									goto(`/characters/${character.id}/log/new`);
								}
							]
						])}
					>
						New Log <kbd class="kbd kbd-sm text-base-content max-sm:hover-none:hidden">N</kbd>
					</a>
				{/if}
				<Search name={searchKey} placeholder="Search Logs" />
				{#if myCharacter}
					<a
						href={`/characters/${character.id}/log/new`}
						class="btn btn-primary sm:hidden sm:px-3 sm:btn-sm"
						aria-label="New Log"
					>
						<span class="iconify size-6 mdi--plus"></span>
					</a>
					<button
						class="btn data-[desc=true]:btn-primary sm:hidden"
						data-desc={global.app.log.descriptions}
						onclick={() =>
							createTransition(async () => {
								global.app.log.descriptions = !global.app.log.descriptions;
							})}
						onkeypress={() => null}
						aria-label="Toggle Notes"
						tabindex="0"
					>
						{#if global.app.log.descriptions}
							<span class="iconify size-6 mdi--note-text"></span>
						{:else}
							<span class="iconify size-6 mdi--note-text-outline"></span>
						{/if}
					</button>
				{/if}
			</div>
			{#if character.logs.length}
				<div class="flex-1 max-sm:hidden"></div>
				<button
					class="btn data-[desc=true]:btn-primary max-sm:hidden sm:btn-sm"
					data-desc={global.app.log.descriptions}
					onclick={() =>
						createTransition(async () => {
							global.app.log.descriptions = !global.app.log.descriptions;
						})}
					onkeypress={() => null}
					aria-label="Toggle Notes"
					tabindex="0"
				>
					{#if global.app.log.descriptions}
						<span class="iconify size-5 mdi--eye"></span>
					{:else}
						<span class="iconify size-5 mdi--eye-off"></span>
					{/if}
					<span class="max-sm:hidden">Notes</span>
				</button>
			{/if}
		</div>
	{/if}

	{#if !sortedResults.length}
		<section class="rounded-lg bg-base-200">
			<div class="flex flex-col gap-4 py-20 text-center">
				<div>No logs found.</div>
				<p>
					<a href="/characters/{character.id}/log/new" class="btn btn-primary">Create a Game Log</a>
				</p>
				<p>
					<a href="/characters/{character.id}/log/new?firstLog=true" class="btn btn-primary">Create an Intro Log</a>
				</p>
			</div>
		</section>
	{:else}
		<section>
			<!-- Mobile List -->
			<ul class="overflow-hidden rounded-lg sm:hidden print:hidden">
				{#each sortedResults as log (log.id)}
					{const hasDescription = $derived(
						!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0
					)}
					<li
						class="border-b border-b-neutral-500/40 last:border-b-0 data-[deleting=true]:hidden"
						data-deleting={deletingLog.has(log.id)}
					>
						<div
							class="swipe-container"
							{@attach swipeAction({
								right: () => deleteLog(log)
							})}
						>
							<div class="content bg-base-200">
								{#if myCharacter}
									<a
										href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="row-link font-semibold whitespace-pre-wrap text-secondary-content"
									>
										<SearchResults text={log.name} terms={search.terms} />
									</a>
								{:else}
									<span class="font-semibold whitespace-pre-wrap">
										<SearchResults text={log.name} terms={search.terms} />
									</span>
								{/if}
								<p class="text-netural-content mb-2 text-sm font-normal whitespace-nowrap">
									{formatDate(new Date(log.showDate), log.timezone)}
								</p>
								{#if log.type === "game" && !log.dm.isUser}
									<p class="text-sm font-normal">
										<span class="font-semibold dark:text-white">DM:</span>
										{#if myCharacter}
											<a href="/dms/{log.dm.id}" class="text-secondary-content">{log.dm.name}</a>
										{:else}
											{log.dm.name}
										{/if}
									</p>
								{/if}
								<!-- Mobile Details -->
								<div class="text-sm">
									{#if log.type === "game"}
										{#if log.experience > 0}
											<p>
												<span class="font-semibold dark:text-white">Experience:</span>
												{log.experience}
											</p>
										{/if}
										{#if log.acp > 0}
											<p>
												<span class="font-semibold dark:text-white">ACP:</span>
												{log.acp}
											</p>
										{/if}
										<p>
											<span class="font-semibold dark:text-white">Levels:</span>
											{log.levelGained} ({log.totalLevel})
										</p>
									{/if}
									{#if log.dtd !== 0}
										<p>
											<span class="font-semibold dark:text-white">Downtime Days:</span>
											{log.dtd}
										</p>
									{/if}
									{#if log.tcp !== 0}
										<p>
											<span class="font-semibold dark:text-white">TCP:</span>
											{log.tcp}
										</p>
									{/if}
									{#if log.gold !== 0}
										<p>
											<span class="font-semibold dark:text-white">Gold:</span>
											{log.gold.toLocaleString()}
										</p>
									{/if}
								</div>
								<!-- Notes -->
								<div class="text-sm data-[desc=false]:hidden" data-desc={global.app.log.descriptions && hasDescription}>
									<hr class="my-2 border-neutral-500/20" />
									{#if log.description?.trim()}
										<h4 class="text-base font-semibold">Notes:</h4>
										<Markdown content={log.description} />
									{/if}
									{#if log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
										<div class="mt-2">
											<Items title="Magic Items:" items={log.magicItemsGained} terms={search.terms} sort filtered formatting />
											{#if log.magicItemsLost.length}
												<p class="mt-2 text-sm whitespace-pre-wrap line-through">
													<SearchResults text={log.magicItemsLost.map((mi) => mi.name).join(" | ")} terms={search.terms} />
												</p>
											{/if}
										</div>
									{/if}
									{#if log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
										{#each log.storyAwardsGained as mi (mi.id)}
											<div class="mt-2 text-sm whitespace-pre-wrap">
												<a
													href={`/characters/${log.characterId}/log/${log.id}`}
													class="row-link pr-2 font-semibold dark:text-white print:block"
												>
													{mi.name}{mi.description ? ":" : ""}
												</a>
												{#if mi.description}
													<Markdown content={mi.description || ""} />
												{/if}
											</div>
										{/each}
										{#if log.storyAwardsLost.length}
											<p class="text-sm whitespace-pre-wrap line-through">
												{log.storyAwardsLost.map((mi) => mi.name).join(" | ")}
											</p>
										{/if}
									{/if}
								</div>
							</div>
							<button class="action right bg-error text-white" aria-label="Delete Log">
								<span class="iconify size-6 mdi--trash-can"></span>
							</button>
						</div>
					</li>
				{/each}
			</ul>

			<!-- Desktop List -->
			<div class="w-full overflow-x-auto rounded-lg bg-base-200 max-sm:hidden print:block!">
				<table class="linked-table table w-full leading-5">
					<thead>
						<tr class="bg-base-300 text-base-content/70">
							<td class="print:p-2">Log Entry</td>
							<td class="max-sm:hidden print:table-cell print:p-2">Advancement</td>
							<td class="max-sm:hidden print:table-cell print:p-2">Treasure</td>
							{#if myCharacter}
								<td class="print:hidden"></td>
							{/if}
						</tr>
					</thead>
					{#each sortedResults as log (log.id)}
						{const hasDescription = $derived(
							!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0
						)}
						<tbody class="data-[deleting=true]:hidden first-of-type:[&>tr>td]:border-t-0" data-deleting={deletingLog.has(log.id)}>
							<tr class="print:text-sm [&>td]:border-0 [&>td]:border-t [&>td]:border-neutral-500/20">
								<td
									class="static! align-top data-[desc=true]:pb-3 sm:pb-3 print:p-2 [desc=true]:pb-0"
									data-desc={hasDescription && global.app.log.descriptions}
								>
									{#if myCharacter}
										<a
											href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
											class="row-link font-semibold whitespace-pre-wrap text-secondary-content"
										>
											<SearchResults text={log.name} terms={search.terms} />
										</a>
									{:else}
										<span class="font-semibold whitespace-pre-wrap">
											<SearchResults text={log.name} terms={search.terms} />
										</span>
									{/if}
									<p class="text-netural-content mb-2 text-sm font-normal whitespace-nowrap">
										{formatDate(new Date(log.showDate), log.timezone)}
									</p>
									{#if log.type === "game" && !log.dm.isUser}
										<p class="text-sm font-normal">
											<span class="font-semibold dark:text-white">DM:</span>
											{#if myCharacter}
												<a href="/dms/{log.dm.id}" class="text-secondary-content">{log.dm.name}</a>
											{:else}
												{log.dm.name}
											{/if}
										</p>
									{/if}
									<!-- Mobile Details -->
									<div class="table-cell font-normal sm:hidden print:hidden">
										{#if log.type === "game"}
											{#if log.experience > 0}
												<p>
													<span class="font-semibold dark:text-white">Experience:</span>
													{log.experience}
												</p>
											{/if}
											{#if log.acp > 0}
												<p>
													<span class="font-semibold dark:text-white">ACP:</span>
													{log.acp}
												</p>
											{/if}
											<p>
												<span class="font-semibold dark:text-white">Levels:</span>
												{log.levelGained} ({log.totalLevel})
											</p>
										{/if}
										{#if log.dtd !== 0}
											<p>
												<span class="font-semibold dark:text-white">Downtime Days:</span>
												{log.dtd}
											</p>
										{/if}
										{#if log.tcp !== 0}
											<p>
												<span class="font-semibold dark:text-white">TCP:</span>
												{log.tcp}
											</p>
										{/if}
										{#if log.gold !== 0}
											<p>
												<span class="font-semibold dark:text-white">Gold:</span>
												{log.gold.toLocaleString()}
											</p>
										{/if}
									</div>
								</td>
								<!-- Advancement -->
								<td class="align-top max-sm:hidden print:table-cell print:p-2">
									{#if log.experience > 0}
										<p>
											<span class="font-semibold dark:text-white">Experience:</span>
											{log.experience}
										</p>
									{/if}
									{#if log.acp > 0}
										<p>
											<span class="font-semibold dark:text-white">ACP:</span>
											{log.acp}
										</p>
									{/if}
									{#if (log.levelGained || 0) > 0}
										<p>
											<span class="font-semibold dark:text-white">Levels:</span>
											{log.levelGained} ({log.totalLevel})
										</p>
									{/if}
									{#if log.dtd !== 0}
										<p>
											<span class="text-sm font-semibold dark:text-white">Downtime Days:</span>
											{log.dtd}
										</p>
									{/if}
								</td>
								<!-- Treasure -->
								<td class="align-top max-sm:hidden print:table-cell print:p-2">
									{#if log.tcp !== 0}
										<p>
											<span class="font-semibold dark:text-white">TCP:</span>
											{log.tcp}
										</p>
									{/if}
									{#if log.gold !== 0}
										<p>
											<span class="font-semibold dark:text-white">Gold:</span>
											{log.gold.toLocaleString()}
										</p>
									{/if}
									{#if log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
										<div>
											<Items
												title="Magic Items:"
												items={log.magicItemsGained}
												terms={search.terms}
												sort
												filtered
												formatting
												matches={log.match.size}
											/>
											<div class="text-sm whitespace-pre-wrap line-through">
												<SearchResults
													text={log.magicItemsLost.map((mi) => mi.name).join(" | ")}
													terms={search.terms}
													matches={log.match.size}
												/>
											</div>
										</div>
									{/if}
								</td>
								<!-- Delete -->
								{#if myCharacter}
									<td class="w-8 align-top print:hidden">
										<div class="flex flex-col justify-center gap-2">
											<button
												type="button"
												class="btn touch-hitbox btn-error btn-sm"
												aria-label="Delete Log"
												onclick={() => deleteLog(log)}
											>
												<span class="iconify size-4 mdi--trash-can"></span>
											</button>
										</div>
									</td>
								{/if}
							</tr>
							<!-- Notes -->
							<tr
								class="hidden border-0 data-[desc=true]:table-row max-sm:data-[mi=true]:table-row [&>td]:border-0"
								data-desc={global.app.log.descriptions && hasDescription}
								data-mi={log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
								style:view-transition-name={`notes-${log.id}`}
							>
								<td colSpan={100} class="max-w-[calc(100vw-50px)] pt-0 text-sm print:p-2 print:text-xs">
									{#if log.description?.trim()}
										<h4 class="text-base font-semibold">
											<a
												href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
												class="row-link"
											>
												Notes:
											</a>
										</h4>
										<Markdown content={log.description} />
									{/if}
									{#if log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
										<div class="mt-2 sm:hidden print:hidden">
											<Items title="Magic Items:" items={log.magicItemsGained} terms={search.terms} sort filtered formatting />
											{#if log.magicItemsLost.length}
												<p class="mt-2 text-sm whitespace-pre-wrap line-through">
													<SearchResults text={log.magicItemsLost.map((mi) => mi.name).join(" | ")} terms={search.terms} />
												</p>
											{/if}
										</div>
									{/if}
									{#if log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
										{#each log.storyAwardsGained as mi (mi.id)}
											<div class="mt-2 text-sm whitespace-pre-wrap">
												<a
													href={`/characters/${log.characterId}/log/${log.id}`}
													class="row-link pr-2 font-semibold dark:text-white print:block"
												>
													{mi.name}{mi.description ? ":" : ""}
												</a>
												{#if mi.description}
													<Markdown content={mi.description || ""} />
												{/if}
											</div>
										{/each}
										{#if log.storyAwardsLost.length}
											<p class="text-sm whitespace-pre-wrap line-through">
												{log.storyAwardsLost.map((mi) => mi.name).join(" | ")}
											</p>
										{/if}
									{/if}
								</td>
							</tr>
						</tbody>
					{/each}
				</table>
			</div>
		</section>
	{/if}
</svelte:boundary>
