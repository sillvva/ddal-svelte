<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { modal, pageLoader } from "$lib/store";
	import { slugify, sorter, stopWords } from "$lib/utils";
	import { setCookie } from "$src/server/cookie";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const character = data.character;
	const myCharacter = character.userId === data.session?.user?.id;

	let deletingLog: string[] = [];

	let search = "";
	const logSearch = new MiniSearch({
		fields: ["logName", "magicItems", "storyAwards"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	let level = 1;
	const logs = character
		? character.logs.map((log) => {
				const level_gained = character.log_levels.find((gl) => gl.id === log.id);
				if (level_gained) level += level_gained.levels;
				return {
					...log,
					level_gained: level_gained?.levels || 0,
					total_level: level,
					score: 0
				};
		  })
		: [];

	const indexed = logs.map((log) => ({
		logId: log.id,
		logName: log.name,
		magicItems: [...log.magic_items_gained.map((item) => item.name), ...log.magic_items_lost.map((item) => item.name)].join(
			" | "
		),
		storyAwards: [...log.story_awards_gained.map((item) => item.name), ...log.story_awards_lost.map((item) => item.name)].join(
			" | "
		)
	}));

	if (indexed.length) logSearch.addAll(indexed);

	$: msResults = logSearch.search(search);
	$: results =
		indexed.length && search.length > 1
			? logs
					.filter((log) => msResults.find((result) => result.id === log.id))
					.map((log) => ({
						...log,
						score: msResults.find((result) => result.id === log.id)?.score || 0 - log.date.getTime()
					}))
					.sort((a, b) => sorter(a.date, b.date))
			: logs.sort((a, b) => sorter(a.date, b.date));

	let descriptions = data.descriptions;
	$: setCookie("characters:descriptions", descriptions);

	function triggerModal(log: (typeof results)[number]) {
		if (log.description && !descriptions) {
			$modal = {
				name: log.name,
				description: log.description,
				date: log.date
			};
		}
	}
</script>

{#if data.session?.user}
	<div class="hidden gap-4 print:hidden sm:flex">
		<BreadCrumbs />

		{#if myCharacter}
			<a href={`/characters/${character.id}/edit`} class="btn-primary btn-sm btn">Edit</a>
			<div class="dropdown-end dropdown">
				<span role="button" tabindex="0" class="btn-sm btn">
					<Icon src="dots-horizontal" class="w-6" />
				</span>
				<ul class="dropdown-content menu rounded-box z-20 w-52 bg-base-100 p-2 shadow">
					<li>
						<a
							download={`${slugify(character.name)}.json`}
							href={`/api/export/characters/${character.id}`}
							target="_blank"
							rel="noreferrer noopener"
						>
							Export
						</a>
					</li>
					<li>
						<form
							method="POST"
							action="?/deleteCharacter"
							use:enhance={() => {
								$pageLoader = true;
								return ({ update, result }) => {
									update();
									if (result.type !== "redirect") $pageLoader = false;
								};
							}}
							class="bg-red-800 hover:bg-red-900"
						>
							<button>Delete Character</button>
						</form>
					</li>
				</ul>
			</div>
		{/if}
	</div>
{/if}

{#if form?.error}
	<div class="alert alert-error mb-4 shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		{form.error}
	</div>
{/if}

<section class="flex">
	<div class="flex flex-1 flex-col gap-6">
		<div class="flex">
			{#if character.image_url}
				<div class="relative mr-4 hidden flex-col items-end justify-center print:hidden xs:flex md:hidden">
					<a
						href={character.image_url}
						target="_blank"
						rel="noreferrer noopener"
						class="mask mask-squircle mx-auto h-20 w-full bg-primary"
					>
						<img src={character.image_url} class="h-full w-full object-cover object-top transition-all" alt={character.name} />
					</a>
				</div>
			{/if}
			<div class="flex w-full flex-col">
				<div class="mb-2 flex gap-4 xs:mb-0">
					<h3 class="flex-1 py-2 font-vecna text-3xl font-bold text-accent-content sm:py-0 sm:text-4xl">{character.name}</h3>
					<div class="dropdown-end dropdown sm:hidden">
						<span role="button" tabindex="0" class="btn">
							<Icon src="dots-horizontal" class="w-6" />
						</span>
						<ul class="dropdown-content menu rounded-box z-20 w-52 bg-base-100 p-2 shadow">
							{#if character.image_url}
								<li class="xs:hidden">
									<a href={character.image_url} target="_blank">View Image</a>
								</li>
							{/if}
							<li>
								<a href={`/characters/${character.id}/edit`}>Edit</a>
							</li>
							<form
								method="POST"
								action="?/deleteCharacter"
								use:enhance={() => {
									$pageLoader = true;
									return ({ update, result }) => {
										update();
										if (result.type !== "redirect") $pageLoader = false;
									};
								}}
								class="bg-red-800 hover:bg-red-900"
							>
								<li>
									<button>Delete Character</button>
								</li>
							</form>
						</ul>
					</div>
				</div>
				<p class="flex-1 text-xs font-semibold xs:text-sm">
					{character.race}
					{character.class}
				</p>
				<p class="flex-1 text-xs">
					{character.campaign}
					{#if character.character_sheet_url}
						<span class="print:hidden">
							-
							<a
								href={character.character_sheet_url}
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
		<div class="flex flex-1 flex-wrap gap-4 print:flex-nowrap xs:flex-nowrap sm:gap-4 md:gap-6">
			<div class="flex basis-full flex-col gap-2 print:basis-1/3 xs:basis-[40%] sm:basis-1/3 sm:gap-4 md:basis-52">
				{#if character.image_url}
					<div class="relative hidden flex-col items-end justify-center print:hidden md:flex">
						<a
							href={character.image_url}
							target="_blank"
							rel="noreferrer noopener"
							class="mask mask-squircle mx-auto h-52 w-full bg-primary"
						>
							<img src={character.image_url} class="h-full w-full object-cover object-top transition-all" alt={character.name} />
						</a>
					</div>
				{/if}
				<div class="flex">
					<h4 class="font-semibold">Level</h4>
					<div class="flex-1 text-right">{character.total_level}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold">Tier</h4>
					<div class="flex-1 text-right">{character.tier}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold">Gold</h4>
					<div class="flex-1 text-right">{character.total_gold.toLocaleString("en-US")}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold">Downtime</h4>
					<div class="flex-1 text-right">{character.total_dtd}</div>
				</div>
			</div>
			<div
				class="divider hidden xs:divider-horizontal before:bg-black/50 after:bg-black/50 dark:before:bg-white/50 dark:after:bg-white/50 print:flex xs:mx-0 xs:flex"
			/>
			<div class="flex basis-full flex-col print:basis-2/3 xs:basis-[60%] sm:basis-2/3 lg:basis-2/3">
				{#if character}
					<div class="flex flex-col gap-4">
						<Items title="Story Awards" items={character.story_awards} collapsible sort />
						<Items title="Magic Items" items={character.magic_items} collapsible formatting sort />
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<div class="mt-4 flex flex-wrap gap-2">
	<div class="flex w-full gap-2 print:hidden sm:max-w-md">
		{#if myCharacter}
			<a
				href={`/characters/${character.id}/log/new`}
				class="btn-primary btn hidden sm:btn-sm sm:inline-flex sm:px-3"
				aria-label="New Log"
			>
				New Log
			</a>
		{/if}
		{#if logs.length}
			<input
				type="text"
				placeholder="Search"
				bind:value={search}
				class="input-bordered input min-w-0 flex-1 sm:input-sm sm:max-w-xs"
			/>
		{/if}
		{#if myCharacter}
			<a href={`/characters/${character.id}/log/new`} class="btn-primary btn sm:btn-sm sm:hidden sm:px-3" aria-label="New Log">
				<Icon src="plus" class="w-6" />
			</a>
			<btn
				class={twMerge("btn sm:hidden", descriptions && "btn-primary")}
				on:click={() => (descriptions = !descriptions)}
				on:keypress
				role="button"
				aria-label="Toggle Notes"
				tabindex="0"
			>
				<Icon src={descriptions ? "show" : "hide"} class="w-6" />
			</btn>
		{/if}
	</div>
	{#if logs.length}
		<div class="hidden flex-1 sm:block" />
		<btn
			class={twMerge("btn hidden sm:btn-sm sm:inline-flex", descriptions && "btn-primary")}
			on:click={() => (descriptions = !descriptions)}
			on:keypress
			role="button"
			aria-label="Toggle Notes"
			tabindex="0"
		>
			<Icon src={descriptions ? "show" : "hide"} class="w-6" />
			<span class="hidden sm:inline-flex">Notes</span>
		</btn>
	{/if}
</div>

<section class="mt-4">
	<div class="w-full overflow-x-auto rounded-lg bg-base-100">
		<table class="table w-full">
			<thead>
				<tr class="bg-base-300">
					<td class="print:p-2">Log Entry</td>
					<td class="hidden print:table-cell print:p-2 sm:table-cell">Advancement</td>
					<td class="hidden print:table-cell print:p-2 sm:table-cell">Treasure</td>
					<td class="hidden print:!hidden md:table-cell">Story Awards</td>
					{#if myCharacter}
						<td class="print:hidden" />
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each results as log, i}
					<tr class={twMerge("border-b-0 border-t-2 border-t-base-200 print:text-sm", deletingLog.includes(log.id) && "hidden")}>
						<td
							class={twMerge(
								"!static pb-0 align-top print:p-2 sm:pb-3",
								(!descriptions || !log.description) && "pb-3",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							<div
								class="whitespace-pre-wrap font-semibold text-accent-content"
								on:click={() => triggerModal(log)}
								on:keypress={() => null}
								role="button"
								tabindex="0"
							>
								<SearchResults text={log.name} {search} />
							</div>
							<p class="text-netural-content mb-2 text-xs font-normal">
								{new Date(log.is_dm_log && log.applied_date ? log.applied_date : log.date).toLocaleString()}
							</p>
							{#if log.dm && log.type === "game" && log.dm.uid !== character.userId}
								<p class="text-sm font-normal">
									<span class="font-semibold">DM:</span>
									{#if myCharacter}
										<a href="/dms/{log.dm.id}" class="text-secondary">{log.dm.name}</a>
									{:else}
										{log.dm.name}
									{/if}
								</p>
							{/if}
							<div class="table-cell font-normal print:hidden sm:hidden">
								{#if log.type === "game"}
									{#if log.experience > 0}
										<p>
											<span class="font-semibold">Experience:</span>&nbsp;{log.experience}
										</p>
									{/if}
									{#if log.acp > 0}
										<p>
											<span class="font-semibold">ACP:</span>
											{log.acp}
										</p>
									{/if}
									<p>
										<span class="font-semibold">Levels:</span>&nbsp;{log.level_gained}&nbsp;({log.total_level})
									</p>
								{/if}
								{#if log.dtd !== 0}
									<p>
										<span class="font-semibold">Downtime&nbsp;Days:</span>&nbsp;{log.dtd}
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
							</div>
						</td>
						<td
							class={twMerge(
								"hidden align-top print:table-cell print:p-2 sm:table-cell",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							{#if log.experience > 0}
								<p>
									<span class="font-semibold">Experience:</span>&nbsp;{log.experience}
								</p>
							{/if}
							{#if log.acp > 0}
								<p>
									<span class="font-semibold">ACP:</span>
									{log.acp}
								</p>
							{/if}
							{#if log.level_gained > 0}
								<p>
									<span class="font-semibold">Levels:</span>&nbsp;{log.level_gained}&nbsp;({log.total_level})
								</p>
							{/if}
							{#if log.dtd !== 0}
								<p>
									<span class="text-sm font-semibold">Downtime&nbsp;Days:</span>&nbsp;{log.dtd}
								</p>
							{/if}
						</td>
						<td
							class={twMerge(
								"hidden align-top print:table-cell print:p-2 sm:table-cell",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
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
							{#if log.magic_items_gained.length > 0 || log.magic_items_lost.length > 0}
								<div>
									<Items
										title="Magic Items:"
										items={log.magic_items_gained}
										{search}
										msResult={msResults.find((result) => result.id === log.id)}
										sort
									/>
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults
											text={log.magic_items_lost.map((mi) => mi.name).join(" | ")}
											{search}
											msResult={msResults.find((result) => result.id === log.id)}
										/>
									</div>
								</div>
							{/if}
						</td>
						<td
							class={twMerge(
								"hidden align-top print:!hidden md:table-cell",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							{#if log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
								<div>
									<Items items={log.story_awards_gained} {search} msResult={msResults.find((result) => result.id === log.id)} />
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults
											text={log.story_awards_lost.map((mi) => mi.name).join(" | ")}
											{search}
											msResult={msResults.find((result) => result.id === log.id)}
										/>
									</div>
								</div>
							{/if}
						</td>
						{#if myCharacter}
							<td
								class={twMerge(
									"w-8 align-top print:hidden",
									log.saving && "bg-neutral-focus",
									(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
										"border-b-0"
								)}
							>
								<div class="flex flex-col justify-center gap-2">
									<a
										href={`/characters/${log.characterId}/log/${log.id}`}
										class="btn-primary btn sm:btn-sm"
										aria-label="Edit Log"
									>
										<Icon src="pencil" class="w-6 sm:w-4" />
									</a>
									<form
										method="POST"
										action="?/deleteLog"
										use:enhance={() => {
											deletingLog = [...deletingLog, log.id];
											return async ({ result }) => {
												await applyAction(result);
												if (form?.error) {
													deletingLog = deletingLog.filter((id) => id !== log.id);
													alert(form.error);
												}
											};
										}}
									>
										<input type="hidden" name="logId" value={log.id} />
										<button
											class="btn sm:btn-sm"
											on:click|preventDefault={(e) => {
												if (confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`))
													e.currentTarget.form?.requestSubmit();
											}}
											aria-label="Delete Log"
										>
											<Icon src="trash-can" class="w-6 sm:w-4" />
										</button>
									</form>
								</div>
							</td>
						{/if}
					</tr>
					{#if log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
						<tr class={twMerge(!descriptions && "hidden print:table-row")}>
							<td
								colSpan={100}
								class={twMerge(
									"max-w-[calc(100vw_-_50px)] pt-0 text-sm print:p-2 print:text-xs",
									log.saving && "bg-neutral-focus"
								)}
							>
								{#if log.description?.trim()}
									<h4 class="text-base font-semibold">Notes:</h4>
									<Markdown content={log.description} />
								{/if}
								{#if log.magic_items_gained.length > 0 || log.magic_items_lost.length > 0}
									<div class="mt-2 print:hidden sm:hidden">
										<Items
											title="Magic Items:"
											items={log.magic_items_gained}
											{search}
											msResult={msResults.find((result) => result.id === log.id)}
											sort
										/>
										{#if log.magic_items_lost.length}
											<p class="mt-2 whitespace-pre-wrap text-sm line-through">
												<SearchResults
													text={log.magic_items_lost.map((mi) => mi.name).join(" | ")}
													{search}
													msResult={msResults.find((result) => result.id === log.id)}
												/>
											</p>
										{/if}
									</div>
								{/if}
								{#if log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
									{#each log.story_awards_gained as mi}
										<div class="mt-2 whitespace-pre-wrap text-sm">
											<span class="pr-2 font-semibold print:block">
												{mi.name}{mi.description ? ":" : ""}
											</span>
											{#if mi.description}
												<Markdown content={mi.description || ""} />
											{/if}
										</div>
									{/each}
									{#if log.story_awards_lost.length}
										<p class="whitespace-pre-wrap text-sm line-through">
											{log.story_awards_lost.map((mi) => mi.name).join(" | ")}
										</p>
									{/if}
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</section>
