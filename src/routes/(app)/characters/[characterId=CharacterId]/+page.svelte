<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageHead(params: RouteParams) {
		const character = await API.characters.queries.get({ param: params.characterId });
		return {
			title: character.name || "Character",
			description: `Level ${character.totalLevel} ${character.race} ${character.class}`,
			image: `${page.url.origin}/characters/${character.id}/og-image.jpg`
		};
	}
</script>

<script lang="ts">
	import { goto, pushState } from "$app/navigation";
	import { page } from "$app/state";
	import { authClient } from "$lib/auth.js";
	import Items from "$lib/components/items.svelte";
	import Markdown from "$lib/components/markdown.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import SearchResults from "$lib/components/search-results.svelte";
	import Search from "$lib/components/search.svelte";
	import { EntitySearchFactory, parseEffectResult, successToast } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { createTransition, hotkey } from "$lib/util";
	import { slugify, sorter } from "@sillvva/utils";
	import { clipboard, download } from "@svelteuidev/composables";
	import { onMount } from "svelte";
	import { fromAction } from "svelte/attachments";
	import { SvelteSet } from "svelte/reactivity";

	const { params } = $props();

	const global = getGlobal();

	const characterQuery = API.characters.queries.get({ param: params.characterId, newRedirect: true });
	const character = $derived(await characterQuery);
	const myCharacter = $derived(character.userId === global.user?.id);

	let deletingLog = new SvelteSet<string>();

	const defaultQuery = $derived(page.url.searchParams.get("s") || "");
	const search = $derived(new EntitySearchFactory(character.logs, defaultQuery));
	const sortedResults = $derived(search.results.toSorted((a, b) => sorter(a.showDate, b.showDate)));

	function triggerImageModal(imageUrl = character.imageUrl) {
		if (imageUrl) {
			pushState("", {
				modal: {
					type: "image",
					name: character.name,
					imageUrl
				}
			});
		}
	}

	function scrollToSearch(searchBar: HTMLDivElement) {
		if (search.query.trim()) scrollTo({ top: searchBar.offsetTop - 16, behavior: "smooth" });
	}

	onMount(() => {
		if (global.app.settings.autoWebAuthn && !global.user) {
			authClient.signIn.passkey({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = `/characters/${character.id}`;
					}
				}
			});
		}
	});
</script>

{#if global.user}
	<NavMenu
		hideMenuActions={!myCharacter}
		crumbs={[
			{ title: "Characters", url: "/characters" },
			{ title: character.name, url: `/characters/${character.id}` }
		]}
	>
		{#snippet actions()}
			<a href={`/characters/${character.id}/edit`} class="btn btn-primary btn-sm h-9 max-sm:hidden">Edit</a>
			<button
				aria-label="Share Character"
				class="btn btn-sm h-9 max-sm:hidden"
				onclick={() => successToast("Character URL copied to clipboard")}
				{@attach fromAction(clipboard, () => page.url.href)}
			>
				<span class="iconify mdi--share-variant size-4"></span>
			</button>
		{/snippet}
		{#snippet menu()}
			<li role="menuitem" class="sm:hidden">
				<a href={`/characters/${character.id}/edit`}>Edit</a>
			</li>
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
							triggerImageModal();
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
						triggerImageModal(`/characters/${character.id}/og-image.jpg`);
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
				<div class="xs:max-md:flex relative mr-4 hidden w-20 flex-col items-end justify-center print:hidden">
					<a
						href={character.imageUrl}
						target="_blank"
						rel="noreferrer noopener"
						class="mask mask-squircle bg-primary mx-auto h-20"
						style:view-transition-name={"image-" + character.id}
						onclick={(e) => {
							e.preventDefault();
							triggerImageModal();
						}}
					>
						<img src={character.imageUrl} class="size-full object-cover object-top transition-all" alt={character.name} />
					</a>
				</div>
			{/if}
			<div class="flex w-full flex-col">
				<div class="xs:mb-0 mb-2 flex gap-4">
					<h3
						class="font-vecna print:text-base-content flex-1 py-2 text-3xl font-bold text-black sm:py-0 sm:text-4xl dark:text-white print:text-2xl"
					>
						{character.name}
					</h3>
				</div>
				<p class="xs:text-sm flex-1 text-xs font-semibold">
					{character.race}
					{character.class}
				</p>
				<p class="flex-1 text-xs">
					{character.campaign}
					{#if character.characterSheetUrl}
						<span class="print:hidden">
							-
							<a
								href={character.characterSheetUrl}
								target="_blank"
								rel="noreferrer noopner"
								class="text-secondary-content font-semibold dark:not-print:drop-shadow-xs"
							>
								Character Sheet
							</a>
						</span>
					{/if}
				</p>
			</div>
		</div>
		<div class="xs:flex-nowrap flex flex-1 flex-wrap gap-4 sm:gap-4 md:gap-6 print:flex-nowrap print:gap-2">
			<div class="xs:basis-[40%] flex basis-full flex-col gap-2 sm:basis-1/3 sm:gap-4 md:basis-52 print:basis-1/3 print:gap-2">
				{#if character.imageUrl}
					<div class="relative flex flex-col items-end justify-center max-md:hidden print:hidden">
						<a
							href={character.imageUrl}
							target="_blank"
							rel="noreferrer noopener"
							class="mask mask-squircle bg-primary mx-auto h-52 w-full"
							style:view-transition-name={"image-" + character.id}
							onclick={(e) => {
								e.preventDefault();
								triggerImageModal();
							}}
						>
							<img src={character.imageUrl} class="size-full object-cover object-top transition-all" alt={character.name} />
						</a>
					</div>
				{/if}
				<div class="flex">
					<h4 class="print:text-base-content font-semibold dark:text-white">Level</h4>
					<div class="flex-1 text-right">{character.totalLevel}</div>
				</div>
				<div class="flex">
					<h4 class="print:text-base-content font-semibold dark:text-white">Tier</h4>
					<div class="flex-1 text-right">{character.tier}</div>
				</div>
				<div class="flex">
					<h4 class="print:text-base-content font-semibold dark:text-white">Gold</h4>
					<div class="flex-1 text-right">{character.totalGold.toLocaleString()}</div>
				</div>
				{#if character.totalTcp}
					<div class="flex">
						<h4 class="print:text-base-content font-semibold dark:text-white">TCP</h4>
						<div class="flex-1 text-right">{character.totalTcp}</div>
					</div>
				{/if}
				<div class="flex">
					<h4 class="print:text-base-content font-semibold dark:text-white">Downtime</h4>
					<div class="flex-1 text-right">{character.totalDtd}</div>
				</div>
			</div>
			<div
				class={[
					"divider xs:divider-horizontal xs:mx-0 max-xs:hidden print:flex",
					"before:bg-black/50 after:bg-black/50 dark:before:bg-white/50 dark:after:bg-white/50"
				].join(" ")}
			></div>
			<div class="xs:basis-[60%] flex basis-full flex-col sm:basis-2/3 lg:basis-2/3 print:basis-2/3">
				{#if character}
					<div class="flex flex-col gap-4">
						<Items title="Story Awards" items={character.storyAwards} collapsible sort search />
						<Items title="Magic Items" items={character.magicItems} collapsible formatting sort search />
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if character.logs.length}
	<div class="mt-4 flex flex-wrap gap-2 print:hidden" {@attach scrollToSearch}>
		<div class="flex w-full gap-2 sm:max-w-md print:hidden">
			{#if myCharacter}
				<a
					href={`/characters/${character.id}/log/new`}
					class="btn btn-primary sm:btn-sm max-sm:hidden sm:px-3"
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
					New Log <kbd class="kbd kbd-sm max-sm:hover-none:hidden text-base-content">N</kbd>
				</a>
			{/if}
			<Search bind:value={search.query} placeholder="Search Logs" />
			{#if myCharacter}
				<a href={`/characters/${character.id}/log/new`} class="btn btn-primary sm:btn-sm sm:hidden sm:px-3" aria-label="New Log">
					<span class="iconify mdi--plus size-6"></span>
				</a>
				<button
					class="btn data-[desc=true]:btn-primary sm:hidden"
					data-desc={global.app.log.descriptions}
					onclick={() =>
						createTransition(() => {
							global.setApp((app) => {
								app.log.descriptions = !app.log.descriptions;
							});
						})}
					onkeypress={() => null}
					aria-label="Toggle Notes"
					tabindex="0"
				>
					{#if global.app.log.descriptions}
						<span class="iconify mdi--note-text size-6"></span>
					{:else}
						<span class="iconify mdi--note-text-outline size-6"></span>
					{/if}
				</button>
			{/if}
		</div>
		{#if character.logs.length}
			<div class="flex-1 max-sm:hidden"></div>
			<button
				class="btn data-[desc=true]:btn-primary sm:btn-sm max-sm:hidden"
				data-desc={global.app.log.descriptions}
				onclick={() =>
					createTransition(() => {
						global.setApp((app) => {
							app.log.descriptions = !app.log.descriptions;
						});
					})}
				onkeypress={() => null}
				aria-label="Toggle Notes"
				tabindex="0"
			>
				{#if global.app.log.descriptions}
					<span class="iconify mdi--eye size-5"></span>
				{:else}
					<span class="iconify mdi--eye-off size-5"></span>
				{/if}
				<span class="max-sm:hidden">Notes</span>
			</button>
		{/if}
	</div>
{/if}

{#if !sortedResults.length}
	<section class="bg-base-200 rounded-lg">
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
		<div class="bg-base-200 w-full overflow-x-auto rounded-lg">
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
					{@const hasDescription =
						!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
					<tbody
						class="border-t border-neutral-500/20 first:border-0 data-[deleting=true]:hidden"
						data-deleting={deletingLog.has(log.id)}
					>
						<tr class="border-0 print:text-sm">
							<td
								class="static! pb-0 align-top data-[desc=true]:pb-3 sm:pb-3 print:p-2"
								data-desc={hasDescription && global.app.log.descriptions}
							>
								{#if myCharacter}
									<a
										href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="row-link text-secondary-content font-semibold whitespace-pre-wrap"
									>
										<SearchResults text={log.name} terms={search.terms} />
									</a>
								{:else}
									<span class="font-semibold whitespace-pre-wrap">
										<SearchResults text={log.name} terms={search.terms} />
									</span>
								{/if}
								<p class="text-netural-content mb-2 text-sm font-normal whitespace-nowrap">
									{new Date(log.showDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
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
												<span class="font-semibold dark:text-white">Experience:</span>&nbsp;{log.experience}
											</p>
										{/if}
										{#if log.acp > 0}
											<p>
												<span class="font-semibold dark:text-white">ACP:</span>
												{log.acp}
											</p>
										{/if}
										<p>
											<span class="font-semibold dark:text-white">Levels:</span>&nbsp;{log.levelGained}&nbsp;({log.totalLevel})
										</p>
									{/if}
									{#if log.dtd !== 0}
										<p>
											<span class="font-semibold dark:text-white">Downtime&nbsp;Days:</span>&nbsp;{log.dtd}
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
										<span class="font-semibold dark:text-white">Experience:</span>&nbsp;{log.experience}
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
										<span class="font-semibold dark:text-white">Levels:</span>&nbsp;{log.levelGained}&nbsp;({log.totalLevel})
									</p>
								{/if}
								{#if log.dtd !== 0}
									<p>
										<span class="text-sm font-semibold dark:text-white">Downtime&nbsp;Days:</span>&nbsp;{log.dtd}
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
										<Items title="Magic Items:" items={log.magicItemsGained} terms={search.terms} sort />
										<div class="text-sm whitespace-pre-wrap line-through">
											<SearchResults text={log.magicItemsLost.map((mi) => mi.name).join(" | ")} terms={search.terms} />
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
											class="btn btn-error btn-sm touch-hitbox"
											aria-label="Delete Log"
											onclick={async () => {
												if (!confirm(`Are you sure you want to delete ${log.name}? This action cannot be undone.`)) return;
												deletingLog.add(log.id);
												const result = await API.logs.actions.deleteLog(log.id);
												const parsed = await parseEffectResult(result);
												if (parsed) {
													successToast(`${log.name} deleted`);
													await characterQuery.refresh();
												} else {
													deletingLog.delete(log.id);
												}
											}}
										>
											<span class="iconify mdi--trash-can size-4"></span>
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
										<Items title="Magic Items:" items={log.magicItemsGained} terms={search.terms} sort />
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
