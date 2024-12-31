<script lang="ts">
	import { goto, pushState } from "$app/navigation";
	import { page } from "$app/state";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import DeleteCharacter from "$lib/components/forms/DeleteCharacter.svelte";
	import DeleteLog from "$lib/components/forms/DeleteLog.svelte";
	import { excludedSearchWords } from "$lib/constants.js";
	import { getTransition, global } from "$lib/stores.svelte.js";
	import { createTransition } from "$lib/util";
	import { slugify, sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";

	let { data } = $props();

	const transition = getTransition();

	const myCharacter = $derived(data.character.userId === data.session?.user?.id);

	let deletingLog = $state<string[]>([]);
	let search = $state(page.url.searchParams.get("s") || "");

	const logSearch = new MiniSearch({
		fields: ["logName", "magicItems", "storyAwards", "logId"],
		idField: "logId",
		processTerm: (term) => (excludedSearchWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	let level = 1;
	const logs = $derived(
		data.character
			? data.character.logs.map((log) => {
					const level_gained = data.character.log_levels.find((gl) => gl.id === log.id);
					if (level_gained) level += level_gained.levels;
					return {
						...log,
						level_gained: level_gained?.levels || 0,
						total_level: level,
						show_date: log.isDmLog && log.appliedDate ? log.appliedDate : log.date,
						score: 0
					};
				})
			: []
	);

	const indexed = $derived(
		logs.map((log) => ({
			logId: log.id,
			logName: log.name,
			magicItems: log.magicItemsGained
				.map((item) => item.name)
				.concat(log.magicItemsLost.map((item) => item.name))
				.join(" | "),
			storyAwards: log.storyAwardsGained
				.map((item) => item.name)
				.concat(log.storyAwardsLost.map((item) => item.name))
				.join(" | ")
		}))
	);

	$effect(() => {
		logSearch.removeAll();
		logSearch.addAll(indexed);
	});

	const msResults = $derived.by(() => {
		if (!logSearch.termCount) logSearch.addAll(indexed);
		return logSearch.search(search);
	});
	const results = $derived(
		indexed.length && search.length > 1
			? logs
					.filter((log) => msResults.find((result) => result.id === log.id))
					.map((log) => ({
						...log,
						score: msResults.find((result) => result.id === log.id)?.score || 0 - log.date.getTime()
					}))
					.sort((a, b) => sorter(a.show_date, b.show_date))
			: logs.sort((a, b) => sorter(a.show_date, b.show_date))
	);

	function triggerImageModal() {
		if (data.character.imageUrl) {
			pushState("", {
				modal: {
					type: "image",
					name: data.character.name,
					imageUrl: data.character.imageUrl
				}
			});
		}
	}

	function scrollToSearch(searchBar: HTMLDivElement) {
		if (search) scrollTo({ top: searchBar.offsetTop - 16, behavior: "smooth" });
	}
</script>

<div
	use:hotkey={[
		[
			"n",
			() => {
				goto(`/characters/${data.character.id}/log/new`);
			}
		]
	]}
></div>

{#if data.session?.user}
	<div class="flex gap-4">
		<BreadCrumbs />
		{#if myCharacter}
			<div class="hidden gap-4 sm:flex print:hidden">
				<a href={`/characters/${data.character.id}/edit`} class="btn btn-primary btn-sm">Edit</a>
				<Dropdown class="dropdown-end">
					{#snippet children({ close })}
						<summary tabindex="0" class="btn btn-sm">
							<span class="iconify size-6 mdi--dots-horizontal"></span>
						</summary>
						<ul class="menu dropdown-content z-20 w-52 rounded-box bg-base-200 p-2 shadow">
							<li use:close>
								<button
									use:download={{
										blob: new Blob([JSON.stringify(data.character)]),
										filename: `${slugify(data.character.name)}.json`
									}}
								>
									Export
								</button>
							</li>
							<li>
								<DeleteCharacter character={data.character} label="Delete Character" />
							</li>
						</ul>
					{/snippet}
				</Dropdown>
			</div>
			<Dropdown class="dropdown-end sm:hidden">
				{#snippet children({ close })}
					<summary tabindex="0" class="btn">
						<span class="iconify size-6 mdi--dots-horizontal"></span>
					</summary>
					<ul class="menu dropdown-content z-20 w-52 rounded-box bg-base-200 p-2 shadow">
						{#if data.character.imageUrl}
							<li class="xs:hidden" use:close>
								<a
									href={data.character.imageUrl}
									target="_blank"
									onclick={(e) => {
										e.preventDefault();
										triggerImageModal();
									}}>View Image</a
								>
							</li>
						{/if}
						{#if myCharacter}
							<li use:close>
								<a href={`/characters/${data.character.id}/edit`}>Edit</a>
							</li>
							<li use:close>
								<DeleteCharacter character={data.character} label="Delete Character" />
							</li>
						{/if}
					</ul>
				{/snippet}
			</Dropdown>
		{/if}
	</div>
{/if}

<section class="flex">
	<div class="flex flex-1 flex-col gap-6">
		<div class="flex">
			{#if data.character.imageUrl}
				<div class="relative mr-4 hidden w-20 flex-col items-end justify-center xs:max-md:flex print:hidden">
					<a
						href={data.character.imageUrl}
						target="_blank"
						rel="noreferrer noopener"
						class="mask mask-squircle mx-auto h-20 bg-primary"
						use:transition={slugify("image-" + data.character.id)}
						onclick={(e) => {
							e.preventDefault();
							triggerImageModal();
						}}
					>
						<img
							src={data.character.imageUrl}
							class="size-full object-cover object-top transition-all"
							alt={data.character.name}
						/>
					</a>
				</div>
			{/if}
			<div class="flex w-full flex-col">
				<div class="mb-2 flex gap-4 xs:mb-0">
					<h3 class="flex-1 py-2 font-vecna text-3xl font-bold text-black dark:text-white sm:py-0 sm:text-4xl">
						{data.character.name}
					</h3>
				</div>
				<p class="flex-1 text-xs font-semibold xs:text-sm">
					{data.character.race}
					{data.character.class}
				</p>
				<p class="flex-1 text-xs">
					{data.character.campaign}
					{#if data.character.characterSheetUrl}
						<span class="print:hidden">
							-
							<a
								href={data.character.characterSheetUrl}
								target="_blank"
								rel="noreferrer noopner"
								class="font-semibold text-secondary dark:drop-shadow-sm"
							>
								Character Sheet
							</a>
						</span>
					{/if}
				</p>
			</div>
		</div>
		<div class="flex flex-1 flex-wrap gap-4 xs:flex-nowrap sm:gap-4 md:gap-6 print:flex-nowrap print:gap-2">
			<div class="flex basis-full flex-col gap-2 xs:basis-[40%] sm:basis-1/3 sm:gap-4 md:basis-52 print:basis-1/3 print:gap-2">
				{#if data.character.imageUrl}
					<div class="relative hidden flex-col items-end justify-center md:flex print:hidden">
						<a
							href={data.character.imageUrl}
							target="_blank"
							rel="noreferrer noopener"
							class="mask mask-squircle mx-auto h-52 w-full bg-primary"
							use:transition={slugify("image-" + data.character.id)}
							onclick={(e) => {
								e.preventDefault();
								triggerImageModal();
							}}
						>
							<img
								src={data.character.imageUrl}
								class="size-full object-cover object-top transition-all"
								alt={data.character.name}
							/>
						</a>
					</div>
				{/if}
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Level</h4>
					<div class="flex-1 text-right">{data.character.total_level}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Tier</h4>
					<div class="flex-1 text-right">{data.character.tier}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Gold</h4>
					<div class="flex-1 text-right">{data.character.total_gold.toLocaleString()}</div>
				</div>
				{#if data.character.total_tcp}
					<div class="flex">
						<h4 class="font-semibold dark:text-white">TCP</h4>
						<div class="flex-1 text-right">{data.character.total_tcp}</div>
					</div>
				{/if}
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Downtime</h4>
					<div class="flex-1 text-right">{data.character.total_dtd}</div>
				</div>
			</div>
			<div
				class={[
					"divider hidden xs:divider-horizontal xs:mx-0 xs:flex print:flex",
					"before:bg-black/50 after:bg-black/50 dark:before:bg-white/50 dark:after:bg-white/50"
				].join(" ")}
			></div>
			<div class="flex basis-full flex-col xs:basis-[60%] sm:basis-2/3 lg:basis-2/3 print:basis-2/3">
				{#if data.character}
					<div class="flex flex-col gap-4">
						<Items title="Story Awards" items={data.character.story_awards} collapsible sort />
						<Items title="Magic Items" items={data.character.magic_items} collapsible formatting sort />
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<div class="mt-4 flex flex-wrap gap-2 print:hidden" use:scrollToSearch>
	<div class="flex w-full gap-2 sm:max-w-md print:hidden">
		{#if myCharacter}
			<a
				href={`/characters/${data.character.id}/log/new`}
				class="btn btn-primary sm:btn-sm max-sm:hidden sm:px-3"
				aria-label="New Log"
			>
				New Log
			</a>
		{/if}
		{#if logs.length}
			<Search bind:value={search} placeholder="Search Logs" />
		{/if}
		{#if myCharacter}
			<a
				href={`/characters/${data.character.id}/log/new`}
				class="btn btn-primary sm:btn-sm sm:hidden sm:px-3"
				aria-label="New Log"
			>
				<span class="iconify size-6 mdi--plus"></span>
			</a>
			<button
				class="btn data-[desc=true]:btn-primary sm:hidden"
				data-desc={global.app.log.descriptions}
				onclick={() => createTransition(() => (global.app.log.descriptions = !global.app.log.descriptions))}
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
	{#if logs.length}
		<div class="flex-1 max-sm:hidden"></div>
		<button
			class="btn data-[desc=true]:btn-primary sm:btn-sm max-sm:hidden"
			data-desc={global.app.log.descriptions}
			onclick={() => createTransition(() => (global.app.log.descriptions = !global.app.log.descriptions))}
			onkeypress={() => null}
			aria-label="Toggle Notes"
			tabindex="0"
		>
			{#if global.app.log.descriptions}
				<span class="iconify size-6 mdi--eye"></span>
			{:else}
				<span class="iconify size-6 mdi--eye-off"></span>
			{/if}
			<span class="max-sm:hidden">Notes</span>
		</button>
	{/if}
</div>

<section class="mt-4">
	<div class="w-full overflow-x-auto rounded-lg bg-base-200">
		<table class="table w-full leading-5">
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
			<tbody>
				{#each results as log, i}
					{@const hasDescription =
						!!log.description?.trim() || log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
					<tr
						class="data-[deleting=true]:hidden print:text-sm [&>td]:border-b-0 [&>td]:border-t [&>td]:border-t-base-300"
						data-deleting={deletingLog.includes(log.id)}
					>
						<td
							class="!static pb-0 align-top data-[desc=true]:pb-3 sm:pb-3 print:p-2"
							data-desc={hasDescription && global.app.log.descriptions}
						>
							{#if myCharacter}
								<a
									href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
									class="whitespace-pre-wrap text-left font-semibold text-secondary"
									aria-label="Edit Log"
								>
									<SearchResults text={log.name} {search}></SearchResults>
								</a>
							{:else}
								<span class="whitespace-pre-wrap text-left font-semibold">
									<SearchResults text={log.name} {search}></SearchResults>
								</span>
							{/if}
							<p class="text-netural-content mb-2 whitespace-nowrap text-sm font-normal">
								{new Date(log.show_date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
							</p>
							{#if log.dm && log.type === "game" && log.dm.uid !== data.character.userId}
								<p class="text-sm font-normal">
									<span class="font-semibold dark:text-white">DM:</span>
									{#if myCharacter}
										<a href="/dms/{log.dm.id}" class="text-secondary">{log.dm.name}</a>
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
										<span class="font-semibold dark:text-white">Levels:</span>&nbsp;{log.level_gained}&nbsp;({log.total_level})
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
							{#if log.level_gained > 0}
								<p>
									<span class="font-semibold dark:text-white">Levels:</span>&nbsp;{log.level_gained}&nbsp;({log.total_level})
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
									<Items title="Magic Items:" items={log.magicItemsGained} {search} sort />
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults text={log.magicItemsLost.map((mi) => mi.name).join(" | ")} {search} />
									</div>
								</div>
							{/if}
						</td>
						<!-- Delete -->
						{#if myCharacter}
							<td class="w-8 align-top print:hidden">
								<div class="flex flex-col justify-center gap-2">
									<DeleteLog {log} bind:deletingLog />
								</div>
							</td>
						{/if}
					</tr>
					<!-- Notes -->
					<tr
						class="hidden data-[desc=true]:table-row data-[deleting=true]:!hidden data-[mi=true]:max-sm:table-row"
						data-deleting={deletingLog.includes(log.id)}
						data-desc={global.app.log.descriptions && hasDescription}
						data-mi={log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
						use:transition={slugify(`notes-${log.id}`)}
					>
						<td colSpan={100} class="max-w-[calc(100vw_-_50px)] pt-0 text-sm print:p-2 print:text-xs">
							{#if log.description?.trim()}
								<h4 class="text-base font-semibold">Notes:</h4>
								<Markdown content={log.description} />
							{/if}
							{#if log.magicItemsGained.length > 0 || log.magicItemsLost.length > 0}
								<div class="mt-2 sm:hidden print:hidden">
									<Items title="Magic Items:" items={log.magicItemsGained} {search} sort />
									{#if log.magicItemsLost.length}
										<p class="mt-2 whitespace-pre-wrap text-sm line-through">
											<SearchResults text={log.magicItemsLost.map((mi) => mi.name).join(" | ")} {search} />
										</p>
									{/if}
								</div>
							{/if}
							{#if log.storyAwardsGained.length > 0 || log.storyAwardsLost.length > 0}
								{#each log.storyAwardsGained as mi}
									<div class="mt-2 whitespace-pre-wrap text-sm">
										<span class="pr-2 font-semibold dark:text-white print:block">
											{mi.name}{mi.description ? ":" : ""}
										</span>
										{#if mi.description}
											<Markdown content={mi.description || ""} />
										{/if}
									</div>
								{/each}
								{#if log.storyAwardsLost.length}
									<p class="whitespace-pre-wrap text-sm line-through">
										{log.storyAwardsLost.map((mi) => mi.name).join(" | ")}
									</p>
								{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
