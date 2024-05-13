<script lang="ts">
	import { goto, pushState } from "$app/navigation";
	import { page } from "$app/stores";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Items from "$lib/components/Items.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import DeleteLog from "$lib/components/forms/DeleteLog.svelte";
	import { stopWords } from "$lib/constants";
	import type { CookieStore } from "$server/cookie.js";
	import { sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";
	import { getContext } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let data;

	$: logs = data.logs;
	const app = getContext<CookieStore<App.Cookie>>("app");

	let search = $page.url.searchParams.get("s") || "";
	let deletingLog: string[] = [];

	$: indexed = logs
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
		: [];

	const dmLogSearch = new MiniSearch({
		fields: ["logName", "characterName", "magicItems", "storyAwards", "logId"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	$: {
		dmLogSearch.removeAll();
		dmLogSearch.addAll(indexed);
	}
	$: msResults = dmLogSearch.search(search);
	$: results =
		indexed.length && search.length > 1
			? logs
					.filter((log) => msResults.find((result) => result.id === log.id))
					.map((log) => ({
						...log,
						score: msResults.find((result) => result.id === log.id)?.score || 0 - log.date.getTime()
					}))
					.sort((a, b) => ($app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)))
			: logs.sort((a, b) => ($app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)));
	$: hasStoryAwards = results.find((log) => log.storyAwardsGained.length);

	function triggerModal(log: (typeof results)[number]) {
		if (log.description) {
			pushState("", {
				modal: {
					type: "text",
					name: log.name,
					description: log.description,
					date: log.date
				}
			});
		}
	}
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
/>

<div class="flex flex-col gap-4">
	<div class="hidden gap-4 sm:flex print:hidden">
		<BreadCrumbs />
		<Dropdown class="dropdown-end" let:close>
			<summary tabindex="0" class="btn btn-sm">
				<span class="mdi--dots-horizontal iconify size-6" />
			</summary>
			<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
				<li use:close>
					<button use:download={{ blob: new Blob([JSON.stringify(logs)]), filename: "dm-logs.json" }}>Export</button>
				</li>
			</ul>
		</Dropdown>
	</div>

	<div class="flex gap-2 sm:justify-between">
		<div class="flex w-full gap-2 sm:w-96">
			<a href="/dm-logs/new" class="btn btn-primary btn-sm max-sm:hidden" aria-label="New Log">New Log</a>
			<Search bind:value={search} placeholder="Search by name, race, class, items, etc." />
			<a href="/dm-logs/new" class="btn btn-primary inline-flex sm:hidden" aria-label="New Log">
				<span class="mdi--plus iconify inline size-6" />
			</a>
		</div>
		<button class="btn btn-primary sm:btn-sm" on:click={() => ($app.dmLogs.sort = $app.dmLogs.sort === "asc" ? "desc" : "asc")}>
			<span
				class={twMerge(
					"iconify size-6",
					$app.dmLogs.sort === "asc" ? "mdi--sort-calendar-ascending" : "mdi--sort-calendar-descending"
				)}
			/>
		</button>
	</div>

	<section>
		<div class="w-full overflow-x-auto rounded-lg bg-base-200">
			<table class="table w-full">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th class="table-cell sm:hidden print:hidden">Game</th>
						<th class="hidden sm:table-cell print:table-cell">Title</th>
						<th class="hidden sm:table-cell print:table-cell">Advancement</th>
						<th class="hidden sm:table-cell print:table-cell">Treasure</th>
						{#if hasStoryAwards}
							<th class="hidden sm:table-cell print:table-cell">Story Awards</th>
						{/if}
						<th class="print:hidden" />
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
							<tr class={twMerge(deletingLog.includes(log.id) && "hidden")}>
								<td
									class={twMerge(
										"!static align-top",
										(log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0) &&
											"print:border-b-0"
									)}
								>
									<button
										class="whitespace-pre-wrap text-left font-semibold text-black dark:text-white"
										on:click={() => triggerModal(log)}
									>
										<SearchResults text={log.name} {search} />
									</button>
									<p class="text-netural-content whitespace-nowrap text-xs font-normal">{new Date(log.date).toLocaleString()}</p>
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
												{log.gold.toLocaleString("en-US")}
											</p>
										{/if}
										<div>
											<Items title="Magic Items" items={log.magicItemsGained} {search} sort />
										</div>
									</div>
								</td>
								<td
									class={twMerge(
										"hidden align-top sm:table-cell print:table-cell",
										(log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0) &&
											"print:border-b-0"
									)}
								>
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
								<td
									class={twMerge(
										"hidden align-top sm:table-cell print:table-cell",
										(log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0) &&
											"print:border-b-0"
									)}
								>
									{#if log.tcp !== 0}
										<p>
											<span class="font-semibold">TCP:</span>
											{log.tcp}
										</p>
									{/if}
									{#if log.gold !== 0}
										<p>
											<span class="font-semibold">Gold:</span>
											{log.gold.toLocaleString("en-US")}
										</p>
									{/if}
									{#if log.magicItemsGained.length > 0}
										<div>
											<Items title="Magic Items" items={log.magicItemsGained} {search} sort />
										</div>
									{/if}
								</td>
								{#if hasStoryAwards}
									<td
										class={twMerge(
											"hidden align-top md:table-cell print:!hidden",
											(log.description?.trim() || log.storyAwardsGained.length > 0) && "print:border-b-0"
										)}
									>
										{#if log.storyAwardsGained.length > 0}
											<div>
												<Items items={log.storyAwardsGained} {search} />
											</div>
										{/if}
									</td>
								{/if}
								<td class="w-8 align-top print:hidden">
									<div class="flex flex-col gap-2">
										<a href="/dm-logs/{log.id}" class="btn btn-primary sm:btn-sm" aria-label="Edit Log">
											<span class="mdi--pencil iconify" />
										</a>
										<DeleteLog {log} bind:deletingLog />
									</div>
								</td>
							</tr>
							{#if log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
								<tr class={twMerge("hidden print:table-row", deletingLog.includes(log.id) && "hidden")}>
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
