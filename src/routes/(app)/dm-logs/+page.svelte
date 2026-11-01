<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Head from "#lib/components/head.svelte";
	import Items from "#lib/components/items.svelte";
	import Markdown from "#lib/components/markdown.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import SearchResults from "#lib/components/search-results.svelte";
	import Search from "#lib/components/search.svelte";
	import { EntitySearchFactory, successToast, swipeAction } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import type { FullLogData } from "#lib/server/effect/services/logs.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { createTransition, download, formatDate, hotkey, newestDraftId, parseEffectResult } from "#lib/util.js";
	import { sorter } from "@sillvva/utils";
	import { SvelteSet } from "svelte/reactivity";

	const global = getGlobal();

	let deletingLog = new SvelteSet<string>();
	const searchKey = "s";

	async function deleteLog(log: FullLogData) {
		if (!confirm(`Are you sure you want to delete ${log.name}? This action cannot be undone.`)) return;
		deletingLog.add(log.id);
		const result = await API.logs.actions.deleteLog(log.id);
		const parsed = await parseEffectResult(result);
		if (parsed) {
			successToast(`${log.name} deleted`);
		} else {
			deletingLog.delete(log.id);
		}
	}
</script>

<svelte:boundary>
	{const { user } = $derived(await API.app.queries.request())}
	{const logs = $derived(await API.logs.queries.getDmLogs())}
	{const search = $derived(
		new EntitySearchFactory(logs, page.url.searchParams.get(searchKey) ?? page.state.search?.[searchKey] ?? "")
	)}
	{const sortedResults = $derived(
		search.results.toSorted((a, b) => (global.app.dmLogs.sort === "asc" ? sorter(a.date, b.date) : sorter(b.date, a.date)))
	)}
	{const newLogHref = $derived(`/dm-logs/new?draft=${encodeURIComponent(newestDraftId(logs.map((log) => log.id)))}`)}

	<Head title="{user?.name}'s DM Logs" />

	<NavMenu base crumbs={[{ title: "DM Logs", url: "/dm-logs" }]}>
		{#snippet menu()}
			<li role="menuitem">
				<button
					{@attach download(() => ({
						filename: "dm-logs.json",
						blob: new Blob([JSON.stringify(logs)])
					}))}
				>
					Export
				</button>
			</li>
		{/snippet}
	</NavMenu>

	<div class="flex gap-2 sm:justify-between">
		<div class="flex gap-2 max-sm:flex-1 sm:w-96">
			<a
				href={newLogHref}
				class="btn btn-primary btn-sm max-sm:hidden"
				aria-label="New Log"
				{@attach hotkey([
					[
						"n",
						() => {
							goto(newLogHref);
						}
					]
				])}
			>
				New Log <kbd class="kbd kbd-sm text-base-content max-sm:hover-none:hidden">N</kbd>
			</a>
			<Search name={searchKey} placeholder="Search by name, class, items, etc." />
			<a href={newLogHref} class="btn inline-flex btn-primary sm:hidden" aria-label="New Log">
				<span class="iconify inline size-6 mdi--plus"></span>
			</a>
		</div>
		<div class="flex gap-2">
			<button
				class="btn data-[desc=true]:btn-primary sm:btn-sm"
				data-desc={global.app.dmLogs.descriptions}
				onclick={() =>
					createTransition(() => {
						global.app.dmLogs.descriptions = !global.app.dmLogs.descriptions;
					})}
				onkeypress={() => null}
				aria-label="Toggle Notes"
				tabindex="0"
			>
				{#if global.app.dmLogs.descriptions}
					<span class="iconify size-5 mdi--eye max-md:size-6"></span>
				{:else}
					<span class="iconify size-5 mdi--eye-off max-md:size-6"></span>
				{/if}
				<span class="max-sm:hidden">Notes</span>
			</button>
			<button
				class="btn btn-primary sm:btn-sm"
				onclick={() => {
					global.app.dmLogs.sort = global.app.dmLogs.sort === "asc" ? "desc" : "asc";
				}}
				aria-label="Sort"
			>
				<span
					class="iconify size-5 data-[sort=asc]:mdi--sort-calendar-ascending data-[sort=desc]:mdi--sort-calendar-descending max-md:size-6"
					data-sort={global.app.dmLogs.sort}
				></span>
			</button>
		</div>
	</div>

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
							<a
								href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
								class="row-link font-semibold whitespace-pre-wrap text-secondary-content"
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
									<a href="/characters/{log.character.id}" class="text-secondary-content">
										<SearchResults text={log.character.name} terms={search.terms} />
									</a>
								</p>
							{/if}
							<div class="text-sm">
								<!-- Mobile Details -->
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
							<!-- Notes -->
							<div class="text-sm data-[desc=false]:hidden" data-desc={global.app.dmLogs.descriptions && hasDescription}>
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
			<table class="linked-table table w-full">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th class="table-cell sm:hidden print:hidden">Game</th>
						<th class="max-sm:hidden print:table-cell">Title</th>
						<th class="max-sm:hidden print:table-cell">Advancement</th>
						<th class="max-sm:hidden print:table-cell">Treasure</th>
						<th class="print:hidden"></th>
					</tr>
				</thead>
				{#if logs.length == 0}
					<tbody>
						<tr>
							<td colSpan={5} class="py-20 text-center">
								<p class="mb-4">You have no DM logs.</p>
								<p>
									<a href={newLogHref} class="btn btn-primary">Create one now</a>
								</p>
							</td>
						</tr>
					</tbody>
				{:else}
					{#each sortedResults as log (log.id)}
						{const hasDescription = $derived(
							!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0
						)}
						<tbody class="first-of-type:[&>tr>td]:border-t-0">
							<tr
								class="data-[deleting=true]:hidden [&>td]:border-0 [&>td]:border-t [&>td]:border-neutral-500/20"
								data-deleting={deletingLog.has(log.id)}
							>
								<td class="static! align-top">
									<a
										href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="row-link font-semibold whitespace-pre-wrap text-secondary-content"
										aria-label="Edit Log"
									>
										<SearchResults text={log.name} terms={search.terms} />
									</a>
									<p class="text-netural-content text-xs font-normal whitespace-nowrap">
										{formatDate(new Date(log.date), log.timezone)}
									</p>
									{#if log.character}
										<p class="text-sm font-normal">
											<span class="font-semibold">Character:</span>
											<a href="/characters/{log.character.id}" class="text-secondary-content">
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
								<td class="align-top max-sm:hidden print:table-cell">
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
								<td class="align-top max-sm:hidden print:table-cell">
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
											<Items title="Magic Items" items={log.magicItemsGained} terms={search.terms} sort formatting />
										</div>
									{/if}
								</td>
								<!-- Delete -->
								<td class="w-8 align-top print:hidden">
									<div class="flex flex-col gap-2">
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
							</tr>
							<!-- Notes -->
							<tr
								class="hidden border-0 data-[deleting=true]:hidden! data-[desc=true]:table-row max-sm:data-[mi=true]:table-row [&>td]:border-0"
								data-deleting={deletingLog.has(log.id)}
								data-desc={global.app.dmLogs.descriptions && hasDescription}
								data-mi={log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
							>
								<td colSpan={3} class="pt-0">
									{#if log.description?.trim()}
										<h4 class="text-base font-semibold">
											<a href={`/dm-logs/${log.id}`} class="row-link">Notes:</a>
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
												<a href={`/dm-logs/${log.id}`} class="row-link pr-2 font-semibold dark:text-white print:block">
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
				{/if}
			</table>
		</div>
	</section>
</svelte:boundary>
