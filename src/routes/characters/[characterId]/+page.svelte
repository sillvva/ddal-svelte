<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { slugify } from "$lib/misc";
	import { setCookie } from "$src/server/cookie";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const character = data.character;
	const myCharacter = character.userId === data.session?.user?.id;

	let deletingCharacter = false;
	let deletingLog: string[] = [];

	let search = "";
	let stopWords = new Set(["and", "or", "to", "in", "a", "the"]);
	const logSearch = new MiniSearch({
		fields: ["logName", "magicItems", "storyAwards"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		searchOptions: {
			prefix: true
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
		magicItems: [...log.magic_items_gained.map((item) => item.name), ...log.magic_items_lost.map((item) => item.name)].join(", "),
		storyAwards: [...log.story_awards_gained.map((item) => item.name), ...log.story_awards_lost.map((item) => item.name)].join(
			", "
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
					.sort((a, b) => a.date.getTime() - b.date.getTime())
			: logs.sort((a, b) => a.date.getTime() - b.date.getTime());

	let descriptions = data.descriptions;

	$: {
		setCookie("characters:descriptions", descriptions);
	}

	let modal: { name: string; description: string; date: Date } | null = null;

	function triggerModal(log: (typeof results)[0]) {
		if (log.description && !descriptions) {
			modal = {
				name: log.name,
				description: log.description,
				date: log.date
			};
		}
	}
</script>

<div class="flex gap-4 print:hidden">
	<div class="breadcrumbs mb-4 flex-1 text-sm">
		<ul>
			<li>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
					><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
				>
			</li>
			<li>
				<a href="/characters" class="text-secondary">Characters</a>
			</li>
			<li class="overflow-hidden text-ellipsis whitespace-nowrap dark:drop-shadow-md">{character.name}</li>
		</ul>
	</div>
	{#if myCharacter}
		<a href={`/characters/${character.id}/edit`} class="btn-primary btn-sm btn hidden sm:flex">Edit</a>
		<div class="dropdown-end dropdown">
			<span tabIndex={1} class="btn-sm btn">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
					><title>dots-horizontal</title><path
						fill="currentColor"
						d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
					/></svg
				>
			</span>
			<ul tabIndex={1} class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
				<li class="flex sm:hidden">
					<a href={`/characters/${character.id}/edit`}>Edit</a>
				</li>
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
							deletingCharacter = true;
							return ({ update }) => {
								update();
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

<section class="flex">
	<div class="flex flex-1 flex-col gap-6">
		<div class="flex flex-col">
			<h3 class="flex-1 font-vecna text-4xl font-bold text-accent-content">{character.name}</h3>
			<p class="flex-1 text-sm font-semibold">
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
		<div class="flex flex-1 flex-wrap gap-4 print:flex-nowrap sm:flex-nowrap sm:gap-4 md:gap-6">
			<div class="flex basis-full flex-col gap-2 print:basis-1/3 sm:gap-4 md:basis-52">
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
				class="divider hidden sm:divider-horizontal before:bg-neutral-content/50 after:bg-neutral-content/50 print:flex sm:flex"
			/>
			<div class="flex flex-1 basis-full flex-col print:basis-2/3 sm:basis-2/3 lg:basis-2/3">
				{#if character}
					<div class="flex flex-col gap-4">
						<Items title="Story Awards" items={character.story_awards} collapsible />
						<Items title="Magic Items" items={character.magic_items} collapsible formatting />
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if deletingCharacter}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/50" />
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<span class="loading loading-spinner w-16 text-secondary" />
	</div>
{/if}

<div class="mt-4 flex">
	<div class="flex gap-4 print:hidden">
		{#if myCharacter}
			<a href={`/characters/${character.id}/log/new`} class="btn-primary btn-sm btn px-2 sm:px-3">
				<span class="hidden sm:inline">New Log</span>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="inline w-4 sm:hidden"
					><title>plus</title><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" /></svg
				>
			</a>
		{/if}
		{#if logs.length}
			<input type="text" placeholder="Search" bind:value={search} class="input-bordered input input-sm w-full sm:max-w-xs" />
			{#if myCharacter}
				<div class="form-control">
					<label class="label cursor-pointer py-1">
						<span class="label-text hidden pr-4 sm:inline">Notes</span>
						<input
							type="checkbox"
							class="toggle-primary toggle"
							checked={descriptions}
							on:change={() => (descriptions = !descriptions)}
						/>
					</label>
				</div>
			{/if}
		{/if}
	</div>
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
				{#each results as log}
					<tr class={twMerge("border-b-0 border-t-2 border-t-base-200 print:text-sm", deletingLog.includes(log.id) && "hidden")}>
						<td
							class={twMerge(
								"!static align-top print:p-2",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							<p
								class="whitespace-pre-wrap font-semibold text-accent-content"
								on:click={() => triggerModal(log)}
								on:keypress={() => null}
							>
								<SearchResults text={log.name} {search} />
							</p>
							<p class="text-netural-content mb-2 text-xs font-normal">
								{new Date(log.is_dm_log && log.applied_date ? log.applied_date : log.date).toLocaleString()}
							</p>
							{#if log.dm && log.type === "game" && log.dm.uid !== character.userId}
								<p class="text-sm font-normal">
									<span class="font-semibold">DM:</span>
									{log.dm.name}
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
								<div>
									<Items title="Magic Items" items={log.magic_items_gained} {search} />
									<p class="whitespace-pre-wrap text-sm line-through">
										<SearchResults text={log.magic_items_lost.map((mi) => mi.name).join(" | ")} {search} />
									</p>
								</div>
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
									<Items title="Magic Items" items={log.magic_items_gained} {search} />
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults text={log.magic_items_lost.map((mi) => mi.name).join(" | ")} {search} />
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
									<Items items={log.story_awards_gained} {search} />
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults text={log.story_awards_lost.map((mi) => mi.name).join(" | ")} {search} />
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
									<a href={`/characters/${log.characterId}/log/${log.id}`} class="btn-primary btn-sm btn">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
											><title>pencil</title><path
												fill="currentColor"
												d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
											/></svg
										>
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
											class="btn-sm btn"
											on:click|preventDefault={(e) => {
												if (confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`))
													e.currentTarget.form?.requestSubmit();
											}}
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
												><title>trash-can</title><path
													fill="currentColor"
													d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M9,8H11V17H9V8M13,8H15V17H13V8Z"
												/></svg
											>
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
									"max-w-[calc(100vw_-_50px)] whitespace-pre-wrap pt-0 text-sm print:p-2 print:text-xs",
									log.saving && "bg-neutral-focus"
								)}
							>
								<h4 class="text-base font-semibold">Notes:</h4>
								<Markdown content={log.description || ""} />
								{#if log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
									<div>
										{#each log.story_awards_gained as mi}
											<div class="whitespace-pre-wrap text-sm">
												<span class="pr-2 font-semibold print:block">
													{mi.name}
													{mi.description ? ":" : ""}
												</span>
												<Markdown content={mi.description || ""} />
											</div>
										{/each}
										<p class="whitespace-pre-wrap text-sm line-through">
											{log.story_awards_lost.map((mi) => mi.name).join(" | ")}
										</p>
									</div>
								{/if}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</section>
