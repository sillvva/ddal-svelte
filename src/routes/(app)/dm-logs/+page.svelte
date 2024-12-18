<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Items from "$lib/components/Items.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import DeleteLog from "$lib/components/forms/DeleteLog.svelte";
	import { excludedSearchWords } from "$lib/constants";
	import { global } from "$lib/stores.svelte.js";
	import { sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";

	let { data } = $props();

	const logs = $derived(data.logs);

	let search = $state(page.url.searchParams.get("s") || "");
	let deletingLog = $state<string[]>([]);

	const indexed = $derived(
		logs
			? logs.map((log) => ({
					logId: log.id,
					logName: log.name,
					characterName: log.character?.name || "",
					magicItems: log.magicItemsGained
						.map((i) => i.name)
						.concat(log.magicItemsLost.map((i) => i.name))
						.join(", "),
					storyAwards: log.storyAwardsGained
						.map((i) => i.name)
						.concat(log.storyAwardsLost.map((i) => i.name))
						.join(", ")
				}))
			: []
	);

	const dmLogSearch = new MiniSearch({
		fields: ["logName", "characterName", "magicItems", "storyAwards", "logId"],
		idField: "logId",
		processTerm: (term) => (excludedSearchWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	$effect(() => {
		dmLogSearch.removeAll();
		dmLogSearch.addAll(indexed);
	});
	const msResults = $derived(dmLogSearch.search(search));
	const results = $derived(
		indexed.length && search.length > 1
			? logs
					.filter((log) => msResults.find((result) => result.id === log.id))
					.map((log) => ({
						...log,
						score: msResults.find((result) => result.id === log.id)?.score || 0 - log.date.getTime()
					}))
					.sort((a, b) => (global.app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)))
			: logs.sort((a, b) => (global.app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)))
	);
	const hasStoryAwards = $derived(results.find((log) => log.storyAwardsGained.length));
</script>

<div
	use:hotkey={[
		[
			"n",
			() => {
				goto(`/dm-logs/new`);
			}
		]
	]}
></div>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex print:hidden">
		<BreadCrumbs />
		<Dropdown class="dropdown-end">
			{#snippet children({ close })}
				<summary tabindex="0" class="btn btn-sm">
					<span class="iconify size-6 mdi--dots-horizontal"></span>
				</summary>
				<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
					<li use:close>
						<button use:download={{ blob: new Blob([JSON.stringify(logs)]), filename: "dm-logs.json" }}>Export</button>
					</li>
				</ul>
			{/snippet}
		</Dropdown>
	</div>

	<div class="flex gap-2 sm:justify-between">
		<div class="flex w-full gap-2 sm:w-96">
			<a href="/dm-logs/new" class="btn btn-primary btn-sm max-sm:hidden" aria-label="New Log">New Log</a>
			<Search bind:value={search} placeholder="Search by name, race, class, items, etc." />
			<a href="/dm-logs/new" class="btn btn-primary inline-flex sm:hidden" aria-label="New Log">
				<span class="iconify inline size-6 mdi--plus"></span>
			</a>
		</div>
		<button
			class="btn btn-primary sm:btn-sm"
			onclick={() => (global.app.dmLogs.sort = global.app.dmLogs.sort === "asc" ? "desc" : "asc")}
			aria-label="Sort"
		>
			<span
				class="iconify size-6 data-[sort=asc]:mdi--sort-calendar-ascending data-[sort=desc]:mdi--sort-calendar-descending"
				data-sort={global.app.dmLogs.sort}
			></span>
		</button>
	</div>

	<section>
		<div class="w-full overflow-x-auto rounded-lg bg-base-200">
			<table class="table w-full">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th class="table-cell sm:hidden print:hidden">Game</th>
						<th class="max-sm:hidden print:table-cell">Title</th>
						<th class="max-sm:hidden print:table-cell">Advancement</th>
						<th class="max-sm:hidden print:table-cell">Treasure</th>
						{#if hasStoryAwards}
							<th class="min-w-48 max-lg:hidden print:table-cell">Story Awards</th>
						{/if}
						<th class="print:hidden"></th>
					</tr>
				</thead>
				<tbody>
					{#if logs.length == 0}
						<tr>
							<td colSpan={5} class="py-20 text-center">
								<p class="mb-4">You have no DM logs.</p>
								<p>
									<a href="/dm-logs/new" class="btn btn-primary">Create one now</a>
								</p>
							</td>
						</tr>
					{:else}
						{#each results as log}
							<tr
								class="data-[deleting=true]:hidden [&>td]:border-b-0 [&>td]:border-t [&>td]:border-t-base-300"
								data-deleting={deletingLog.includes(log.id)}
							>
								<td class="!static align-top">
									<a
										href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="whitespace-pre-wrap text-left font-semibold text-secondary"
										aria-label="Edit Log"
									>
										<SearchResults text={log.name} {search} />
									</a>
									<p class="text-netural-content whitespace-nowrap text-xs font-normal">
										{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
									</p>
									{#if log.character}
										<p class="text-sm font-normal">
											<span class="font-semibold">Character:</span>
											<a href="/characters/{log.character.id}" class="text-secondary">
												<SearchResults text={log.character.name} {search} />
											</a>
										</p>
									{/if}
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
										<div>
											<Items title="Magic Items" items={log.magicItemsGained} {search} sort />
										</div>
									</div>
								</td>
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
											<Items title="Magic Items" items={log.magicItemsGained} {search} sort />
										</div>
									{/if}
								</td>
								{#if hasStoryAwards}
									<td class="hidden align-top md:table-cell print:!hidden">
										{#if log.storyAwardsGained.length > 0}
											<div>
												<Items items={log.storyAwardsGained} {search} />
											</div>
										{/if}
									</td>
								{/if}
								<td class="w-8 align-top print:hidden">
									<div class="flex flex-col gap-2">
										<DeleteLog {log} bind:deletingLog />
									</div>
								</td>
							</tr>
							{#if log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
								<tr class="hidden data-[deleting=true]:hidden print:table-row" data-deleting={deletingLog.includes(log.id)}>
									<td colSpan={3} class="pt-0">
										<p class="text-sm">
											<span class="font-semibold">Notes:</span>
											{log.description}
										</p>
										{#if log.storyAwardsGained.length > 0}
											<div>
												{#each log.storyAwardsLost as mi}
													<p class="text-sm">
														<span class="font-semibold">
															{mi.name}
															{mi.description ? ":" : ""}
														</span>
														{mi.description}
													</p>
												{/each}
											</div>
										{/if}
									</td>
								</tr>
							{/if}
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>
</div>
