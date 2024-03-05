<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import { goto, pushState } from "$app/navigation";
	import { page } from "$app/stores";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Dropdown from "$lib/components/Dropdown.svelte";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { errorToast, successToast } from "$lib/factories.js";
	import type { TransitionAction } from "$lib/util";
	import { createTransition, stopWords } from "$lib/util";
	import { pageLoader, searchData } from "$src/routes/(app)/+layout.svelte";
	import type { CookieStore } from "$src/server/cookie.js";
	import { slugify, sorter } from "@sillvva/utils";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";
	import { getContext, onMount } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const app = getContext<CookieStore<App.Cookie>>("app");
	const transition = getContext<TransitionAction>("transition");

	$: character = data.character;
	$: myCharacter = character.userId === data.session?.user?.id;

	let deletingLog: string[] = [];
	let search = $page.url.searchParams.get("s") || "";

	const logSearch = new MiniSearch({
		fields: ["logName", "magicItems", "storyAwards", "logId"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	let level = 1;
	$: logs = character
		? character.logs.map((log) => {
				const level_gained = character.log_levels.find((gl) => gl.id === log.id);
				if (level_gained) level += level_gained.levels;
				return {
					...log,
					level_gained: level_gained?.levels || 0,
					total_level: level,
					show_date: log.is_dm_log && log.applied_date ? log.applied_date : log.date,
					score: 0
				};
			})
		: [];

	$: indexed = logs.map((log) => ({
		logId: log.id,
		logName: log.name,
		magicItems: [...log.magic_items_gained.map((item) => item.name), ...log.magic_items_lost.map((item) => item.name)].join(
			" | "
		),
		storyAwards: [...log.story_awards_gained.map((item) => item.name), ...log.story_awards_lost.map((item) => item.name)].join(
			" | "
		)
	}));

	$: {
		logSearch.removeAll();
		logSearch.addAll(indexed);
	}

	$: msResults = logSearch.search(search);
	$: results =
		indexed.length && search.length > 1
			? logs
					.filter((log) => msResults.find((result) => result.id === log.id))
					.map((log) => ({
						...log,
						score: msResults.find((result) => result.id === log.id)?.score || 0 - log.date.getTime()
					}))
					.sort((a, b) => sorter(a.show_date, b.show_date))
			: logs.sort((a, b) => sorter(a.show_date, b.show_date));

	function triggerModal(log: (typeof results)[number]) {
		if (log.description && !$app.log.descriptions) {
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

	function triggerImageModal() {
		if (character.image_url) {
			pushState("", {
				modal: {
					type: "image",
					name: character.name,
					imageUrl: character.image_url
				}
			});
		}
	}

	let searchBar: HTMLDivElement;
	onMount(() => {
		if (search) scrollTo({ top: searchBar.offsetTop - 16, behavior: "smooth" });
	});
</script>

<div
	use:hotkey={[
		[
			"n",
			() => {
				goto(`/characters/${character.id}/log/new`);
			}
		]
	]}
/>

{#if data.session?.user}
	<div class="group flex gap-4">
		<BreadCrumbs />
		{#if myCharacter}
			<div class="hidden gap-4 sm:flex print:hidden">
				<a href={`/characters/${character.id}/edit`} class="btn btn-primary btn-sm">Edit</a>
				<Dropdown class="dropdown-end">
					<summary tabindex="0" class="btn btn-sm bg-base-100">
						<span class="iconify mdi-[dots-horizontal] size-6" />
					</summary>
					<ul class="menu dropdown-content z-20 w-52 rounded-box bg-base-200 p-2 shadow">
						<li>
							<button use:download={{ blob: new Blob([JSON.stringify(character)]), filename: `${slugify(character.name)}.json` }}>
								Export
							</button>
						</li>
						<li>
							<form
								method="POST"
								action="?/deleteCharacter"
								use:enhance={() => {
									$pageLoader = true;
									return ({ update, result }) => {
										update();
										$searchData = [];
										if (result.type !== "redirect") $pageLoader = false;
									};
								}}
								class="menu-item-error"
							>
								<button
									on:click|preventDefault={(e) => {
										if (confirm(`Are you sure you want to delete ${character.name}? This action cannot be reversed.`))
											e.currentTarget.form?.requestSubmit();
									}}>Delete Character</button
								>
							</form>
						</li>
					</ul>
				</Dropdown>
			</div>
			<Dropdown class="dropdown-end sm:hidden">
				<summary tabindex="0" class="btn">
					<span class="iconify mdi-[dots-horizontal] size-6" />
				</summary>
				<ul class="menu dropdown-content z-20 w-52 rounded-box bg-base-200 p-2 shadow">
					{#if character.image_url}
						<li class="xs:hidden">
							<a
								href={character.image_url}
								target="_blank"
								on:click={(e) => {
									// if (!data.mobile) {
									e.preventDefault();
									triggerImageModal();
									// }
								}}>View Image</a
							>
						</li>
					{/if}
					{#if myCharacter}
						<li>
							<a href={`/characters/${character.id}/edit`}>Edit</a>
						</li>
						<li>
							<form
								method="POST"
								action="?/deleteCharacter"
								use:enhance={() => {
									$pageLoader = true;
									return ({ update, result }) => {
										update();
										if (result.type === "redirect") {
											successToast("Character deleted");
											$searchData = [];
										} else {
											errorToast(form?.error || "Character not deleted");
											$pageLoader = false;
										}
									};
								}}
								class="btn-error"
							>
								<button
									on:click|preventDefault={(e) => {
										if (confirm(`Are you sure you want to delete ${character.name}? This action cannot be reversed.`))
											e.currentTarget.form?.requestSubmit();
									}}>Delete Character</button
								>
							</form>
						</li>
					{/if}
				</ul>
			</Dropdown>
		{/if}
	</div>
{/if}

{#if form?.error}
	<div class="alert alert-error mb-4 shadow-lg">
		<span class="iconify mdi-[alert-circle] size-6" />
		{form.error}
	</div>
{/if}

<section class="flex">
	<div class="flex flex-1 flex-col gap-6">
		<div class="flex">
			{#if character.image_url}
				<div class="relative mr-4 hidden w-20 flex-col items-end justify-center xs:flex md:hidden print:hidden">
					<a
						href={character.image_url}
						target="_blank"
						rel="noreferrer noopener"
						class="mask mask-squircle mx-auto h-20 bg-primary"
						use:transition={slugify("image-" + character.id)}
						on:click={(e) => {
							// if (!data.mobile) {
							e.preventDefault();
							triggerImageModal();
							// }
						}}
					>
						<img src={character.image_url} class="size-full object-cover object-top transition-all" alt={character.name} />
					</a>
				</div>
			{/if}
			<div class="flex w-full flex-col">
				<div class="mb-2 flex gap-4 xs:mb-0">
					<h3 class="flex-1 py-2 font-vecna text-3xl font-bold text-black dark:text-white sm:py-0 sm:text-4xl">
						{character.name}
					</h3>
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
		<div class="flex flex-1 flex-wrap gap-4 xs:flex-nowrap sm:gap-4 md:gap-6 print:flex-nowrap">
			<div class="flex basis-full flex-col gap-2 xs:basis-[40%] sm:basis-1/3 sm:gap-4 md:basis-52 print:basis-1/3">
				{#if character.image_url}
					<div class="relative hidden flex-col items-end justify-center md:flex print:hidden">
						<a
							href={character.image_url}
							target="_blank"
							rel="noreferrer noopener"
							class="mask mask-squircle mx-auto h-52 w-full bg-primary"
							use:transition={slugify("image-" + character.id)}
							on:click={(e) => {
								e.preventDefault();
								triggerImageModal();
							}}
						>
							<img src={character.image_url} class="size-full object-cover object-top transition-all" alt={character.name} />
						</a>
					</div>
				{/if}
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Level</h4>
					<div class="flex-1 text-right">{character.total_level}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Tier</h4>
					<div class="flex-1 text-right">{character.tier}</div>
				</div>
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Gold</h4>
					<div class="flex-1 text-right">{character.total_gold.toLocaleString("en-US")}</div>
				</div>
				{#if character.total_tcp}
					<div class="flex">
						<h4 class="font-semibold dark:text-white">TCP</h4>
						<div class="flex-1 text-right">{character.total_tcp}</div>
					</div>
				{/if}
				<div class="flex">
					<h4 class="font-semibold dark:text-white">Downtime</h4>
					<div class="flex-1 text-right">{character.total_dtd}</div>
				</div>
			</div>
			<div
				class={twMerge(
					"divider hidden xs:divider-horizontal xs:mx-0 xs:flex print:flex",
					"before:bg-black/50 after:bg-black/50 dark:before:bg-white/50 dark:after:bg-white/50"
				)}
			/>
			<div class="flex basis-full flex-col xs:basis-[60%] sm:basis-2/3 lg:basis-2/3 print:basis-2/3">
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

<div class="mt-4 flex flex-wrap gap-2" bind:this={searchBar}>
	<div class="flex w-full gap-2 sm:max-w-md print:hidden">
		{#if myCharacter}
			<a
				href={`/characters/${character.id}/log/new`}
				class="btn btn-primary hidden sm:btn-sm sm:inline-flex sm:px-3"
				aria-label="New Log"
			>
				New Log
			</a>
		{/if}
		{#if logs.length}
			<Search bind:value={search} placeholder="Search Logs" />
		{/if}
		{#if myCharacter}
			<a href={`/characters/${character.id}/log/new`} class="btn btn-primary sm:btn-sm sm:hidden sm:px-3" aria-label="New Log">
				<span class="iconify mdi-[plus] size-6" />
			</a>
			<button
				class={twMerge("no-script-hide btn sm:hidden", $app.log.descriptions && "btn-primary")}
				on:click={() => createTransition(() => ($app.log.descriptions = !$app.log.descriptions))}
				on:keypress
				aria-label="Toggle Notes"
				tabindex="0"
			>
				{#if $app.log.descriptions}
					<span class="iconify mdi-[eye] size-6" />
				{:else}
					<span class="iconify mdi-[eye-off] size-6" />
				{/if}
			</button>
		{/if}
	</div>
	{#if logs.length}
		<div class="hidden flex-1 sm:block" />
		<button
			class={twMerge("no-script-hide btn hidden sm:btn-sm sm:inline-flex", $app.log.descriptions && "btn-primary")}
			on:click={() => createTransition(() => ($app.log.descriptions = !$app.log.descriptions))}
			on:keypress
			aria-label="Toggle Notes"
			tabindex="0"
		>
			{#if $app.log.descriptions}
				<span class="iconify mdi-[eye] size-6" />
			{:else}
				<span class="iconify mdi-[eye-off] size-6" />
			{/if}
			<span class="hidden sm:inline-flex">Notes</span>
		</button>
	{/if}
</div>

<section class="mt-4">
	<div class="w-full overflow-x-auto rounded-lg bg-base-200">
		<table class="table w-full leading-5">
			<thead>
				<tr class="bg-base-300 text-base-content/70">
					<td class="print:p-2">Log Entry</td>
					<td class="hidden sm:table-cell print:table-cell print:p-2">Advancement</td>
					<td class="hidden sm:table-cell print:table-cell print:p-2">Treasure</td>
					<td class="hidden md:table-cell print:!hidden">Story Awards</td>
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
								"!static pb-0 align-top sm:pb-3 print:p-2",
								(!$app.log.descriptions || !log.description) && "pb-3",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							<button
								class="whitespace-pre-wrap text-left font-semibold text-black dark:text-white"
								on:click={() => triggerModal(log)}
							>
								<SearchResults text={log.name} {search} />
							</button>
							<p class="text-netural-content mb-2 whitespace-nowrap text-sm font-normal">
								{new Date(log.show_date).toLocaleString()}
							</p>
							{#if log.dm && log.type === "game" && log.dm.uid !== character.userId}
								<p class="text-sm font-normal">
									<span class="font-semibold dark:text-white">DM:</span>
									{#if myCharacter}
										<a href="/dms/{log.dm.id}" class="text-secondary">{log.dm.name}</a>
									{:else}
										{log.dm.name}
									{/if}
								</p>
							{/if}
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
										{log.gold.toLocaleString("en-US")}
									</p>
								{/if}
							</div>
						</td>
						<td
							class={twMerge(
								"hidden align-top sm:table-cell print:table-cell print:p-2",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
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
						<td
							class={twMerge(
								"hidden align-top sm:table-cell print:table-cell print:p-2",
								log.saving && "bg-neutral-focus",
								(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
									"border-b-0"
							)}
						>
							{#if log.tcp !== 0}
								<p>
									<span class="font-semibold dark:text-white">TCP:</span>
									{log.tcp}
								</p>
							{/if}
							{#if log.gold !== 0}
								<p>
									<span class="font-semibold dark:text-white">Gold:</span>
									{log.gold.toLocaleString("en-US")}
								</p>
							{/if}
							{#if log.magic_items_gained.length > 0 || log.magic_items_lost.length > 0}
								<div>
									<Items title="Magic Items:" items={log.magic_items_gained} {search} sort />
									<div class="whitespace-pre-wrap text-sm line-through">
										<SearchResults text={log.magic_items_lost.map((mi) => mi.name).join(" | ")} {search} />
									</div>
								</div>
							{/if}
						</td>
						<td
							class={twMerge(
								"hidden align-top md:table-cell print:!hidden",
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
									<a
										href={log.is_dm_log ? `/dm-logs/${log.id}` : `/characters/${log.characterId}/log/${log.id}`}
										class="btn btn-primary sm:btn-sm"
										aria-label="Edit Log"
									>
										<span class="iconify mdi-[pencil] size-6 sm:w-4" />
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
													errorToast(form.error);
												} else {
													$searchData = [];
													successToast("Log deleted");
												}
											};
										}}
									>
										<input type="hidden" name="logId" value={log.id} />
										<button
											class="btn btn-error sm:btn-sm"
											on:click|preventDefault={(e) => {
												if (confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`))
													e.currentTarget.form?.requestSubmit();
											}}
											aria-label="Delete Log"
										>
											<span class="iconify mdi-[trash-can] size-6 sm:w-4" />
										</button>
									</form>
								</div>
							</td>
						{/if}
					</tr>
					{#if log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
						<tr class={twMerge(!$app.log.descriptions && "hidden print:table-row")} use:transition={slugify(`notes-${log.id}`)}>
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
									<div class="mt-2 sm:hidden print:hidden">
										<Items title="Magic Items:" items={log.magic_items_gained} {search} sort />
										{#if log.magic_items_lost.length}
											<p class="mt-2 whitespace-pre-wrap text-sm line-through">
												<SearchResults text={log.magic_items_lost.map((mi) => mi.name).join(" | ")} {search} />
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
