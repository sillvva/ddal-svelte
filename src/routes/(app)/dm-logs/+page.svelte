<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import DeleteLog from "$lib/components/forms/DeleteLog.svelte";
	import { EntitySearchFactory } from "$lib/factories.svelte.js";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { createTransition, hotkey } from "$lib/util.js";
	import { sorter } from "@sillvva/utils";
	import { download } from "@svelteuidev/composables";
	import { fromAction } from "svelte/attachments";
	import { SvelteSet } from "svelte/reactivity";

	let { data } = $props();

	const global = getGlobal();

	const search = $derived(new EntitySearchFactory(data.logs));
	const sortedResults = $derived(
		search.results.toSorted((a, b) => (global.app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)))
	);

	$effect(() => {
		search.query = page.url.searchParams.get("s") || "";
	});

	let deletingLog = new SvelteSet<string>();
</script>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex print:hidden">
		<BreadCrumbs />
		<Dropdown class="dropdown-end">
			{#snippet children({ close })}
				<ul class="menu dropdown-content rounded-box bg-base-300 w-52 shadow-sm">
					<li
						{@attach fromAction(download, () => ({
							filename: "dm-logs.json",
							blob: new Blob([JSON.stringify(data.logs)])
						}))}
					>
						<button>Export</button>
					</li>
				</ul>
			{/snippet}
		</Dropdown>
	</div>

	<div class="flex gap-2 sm:justify-between">
		<div class="flex gap-2 sm:w-96">
			<a
				href="/dm-logs/new"
				class="btn btn-primary btn-sm max-sm:hidden"
				aria-label="New Log"
				{@attach hotkey([
					[
						"n",
						() => {
							goto(`/dm-logs/new`);
						}
					]
				])}
			>
				New Log <kbd class="kbd kbd-sm max-sm:hover-none:hidden text-base-content">N</kbd>
			</a>
			<Search bind:value={search.query} placeholder="Search by name, class, items, etc." />
			<a href="/dm-logs/new" class="btn btn-primary inline-flex sm:hidden" aria-label="New Log">
				<span class="iconify mdi--plus inline size-6"></span>
			</a>
		</div>
		<div class="flex gap-2">
			<button
				class="btn data-[desc=true]:btn-primary sm:btn-sm"
				data-desc={global.app.dmLogs.descriptions}
				onclick={() => createTransition(() => (global.app.dmLogs.descriptions = !global.app.dmLogs.descriptions))}
				onkeypress={() => null}
				aria-label="Toggle Notes"
				tabindex="0"
			>
				{#if global.app.log.descriptions}
					<span class="iconify mdi--eye size-5 max-md:size-6"></span>
				{:else}
					<span class="iconify mdi--eye-off size-5 max-md:size-6"></span>
				{/if}
				<span class="max-sm:hidden">Notes</span>
			</button>
			<button
				class="btn btn-primary sm:btn-sm"
				onclick={() => (global.app.dmLogs.sort = global.app.dmLogs.sort === "asc" ? "desc" : "asc")}
				aria-label="Sort"
			>
				<span
					class="iconify data-[sort=asc]:mdi--sort-calendar-ascending data-[sort=desc]:mdi--sort-calendar-descending size-5 max-md:size-6"
					data-sort={global.app.dmLogs.sort}
				></span>
			</button>
		</div>
	</div>

	<section>
		<div class="bg-base-200 w-full overflow-x-auto rounded-lg">
			<table class="table w-full">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th class="table-cell sm:hidden print:hidden">Game</th>
						<th class="max-sm:hidden print:table-cell">Title</th>
						<th class="max-sm:hidden print:table-cell">Advancement</th>
						<th class="max-sm:hidden print:table-cell">Treasure</th>
						<th class="print:hidden"></th>
					</tr>
				</thead>
				<tbody>
					{#if data.logs.length == 0}
						<tr>
							<td colSpan={5} class="py-20 text-center">
								<p class="mb-4">You have no DM logs.</p>
								<p>
									<a href="/dm-logs/new" class="btn btn-primary">Create one now</a>
								</p>
							</td>
						</tr>
					{:else}
						{#each sortedResults as log}
							{@const hasDescription =
								!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
							<tr
								class="[&>td]:border-t-base-300 data-[deleting=true]:hidden [&>td]:border-t [&>td]:border-b-0"
								data-deleting={deletingLog.has(log.id)}
							>
								<td class="static! align-top">
									<a
										href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="text-secondary text-left font-semibold whitespace-pre-wrap"
										aria-label="Edit Log"
									>
										<SearchResults text={log.name} terms={search.terms} />
									</a>
									<p class="text-netural-content text-xs font-normal whitespace-nowrap">
										{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
									</p>
									{#if log.character}
										<p class="text-sm font-normal">
											<span class="font-semibold">Character:</span>
											<a href="/characters/{log.character.id}" class="text-secondary">
												<SearchResults text={log.character.name} terms={search.terms} />
											</a>
										</p>
									{/if}
									<!-- Mobile Details -->
									<div class="table-cell font-normal sm:hidden print:hidden">
										{#if log.type === "game"}
											{#if log.experience > 0}
												<p>
													<span class="font-semibold">Experience:</span>
													{log.experience}
												</p>
											{/if}
											{#if log.acp > 0}
												<p>
													<span class="font-semibold">ACP:</span>
													{log.acp}
												</p>
											{/if}
											{#if log.level > 0}
												<p>
													<span class="font-semibold">Level:</span>
													{log.level}
												</p>
											{/if}
										{/if}
										{#if log.dtd !== 0}
											<p>
												<span class="font-semibold">Downtime Days:</span>
												{log.dtd}
											</p>
										{/if}
										{#if log.tcp !== 0}
											<p>
												<span class="font-semibold">TCP:</span>
												{log.tcp}
											</p>
										{/if}
										{#if log.gold !== 0}
											<p>
												<span class="font-semibold">Gold:</span>
												{log.gold.toLocaleString()}
											</p>
										{/if}
									</div>
								</td>
								<!-- Advancement -->
								<td class="hidden align-top sm:table-cell print:table-cell">
									{#if log.type === "game"}
										{#if log.experience > 0}
											<p>
												<span class="font-semibold">Experience:</span>
												{log.experience}
											</p>
										{/if}
										{#if log.acp > 0}
											<p>
												<span class="font-semibold">ACP:</span>
												{log.acp}
											</p>
										{/if}
										{#if log.level > 0}
											<p>
												<span class="font-semibold">Level:</span>
												{log.level}
											</p>
										{/if}
										{#if log.dtd !== 0}
											<p>
												<span class="text-sm font-semibold">Downtime Days:</span>
												{log.dtd}
											</p>
										{/if}
									{/if}
								</td>
								<!-- Treasure -->
								<td class="hidden align-top sm:table-cell print:table-cell">
									{#if log.tcp !== 0}
										<p>
											<span class="font-semibold">TCP:</span>
											{log.tcp}
										</p>
									{/if}
									{#if log.gold !== 0}
										<p>
											<span class="font-semibold">Gold:</span>
											{log.gold.toLocaleString()}
										</p>
									{/if}
									{#if log.magicItemsGained.length > 0}
										<div>
											<Items title="Magic Items" items={log.magicItemsGained} terms={search.terms} sort />
										</div>
									{/if}
								</td>
								<!-- Delete -->
								<td class="w-8 align-top print:hidden">
									<div class="flex flex-col gap-2">
										<DeleteLog {log} {deletingLog} />
									</div>
								</td>
							</tr>
							<!-- Notes -->
							<tr
								class="hidden data-[deleting=true]:hidden! data-[desc=true]:table-row max-sm:data-[mi=true]:table-row"
								data-deleting={deletingLog.has(log.id)}
								data-desc={global.app.dmLogs.descriptions && hasDescription}
								data-mi={log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
							>
								<td colSpan={3} class="pt-0">
									{#if log.description?.trim()}
										<h4 class="text-base font-semibold">Notes:</h4>
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
										{#each log.storyAwardsGained as mi}
											<div class="mt-2 text-sm whitespace-pre-wrap">
												<span class="pr-2 font-semibold dark:text-white print:block">
													{mi.name}{mi.description ? ":" : ""}
												</span>
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
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>
</div>
