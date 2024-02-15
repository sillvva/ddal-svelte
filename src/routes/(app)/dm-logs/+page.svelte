<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import { goto, pushState } from "$app/navigation";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Items from "$lib/components/Items.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import type { AppStore } from "$lib/schemas";
	import { sorter, stopWords } from "$lib/util";
	import Dropdown from "$src/lib/components/Dropdown.svelte";
	import { download, hotkey } from "@svelteuidev/composables";
	import MiniSearch from "minisearch";
	import { getContext } from "svelte";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const logs = data.logs;
	const app = getContext<AppStore>("app");

	let search = "";
	let deletingLog: string[] = [];

	const indexed = logs
		? logs.map((log) => ({
				logId: log.id,
				logName: log.name,
				characterName: log.character?.name || "",
				magicItems: [...log.magic_items_gained.map((item) => item.name), ...log.magic_items_lost.map((item) => item.name)].join(
					", "
				),
				storyAwards: [
					...log.story_awards_gained.map((item) => item.name),
					...log.story_awards_lost.map((item) => item.name)
				].join(", ")
			}))
		: [];

	const dmLogSearch = new MiniSearch({
		fields: ["logName", "characterName", "magicItems", "storyAwards"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	$: dmLogSearch.addAll(indexed);
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
	$: hasStoryAwards = results.find((log) => log.story_awards_gained.length);

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
		<Dropdown class="dropdown-end">
			<summary tabindex="0" class="btn btn-sm">
				<Icon src="dots-horizontal" class="w-6" />
			</summary>
			<ul class="menu dropdown-content w-52 rounded-box bg-base-200 p-2 shadow">
				<li>
					<button use:download={{ blob: new Blob([JSON.stringify(logs)]), filename: "dm-logs.json" }}>Export</button>
				</li>
			</ul>
		</Dropdown>
	</div>

	{#if form?.error}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form.error}
		</div>
	{/if}

	<div class="flex justify-between gap-2">
		<div class="flex gap-2">
			<a href="/dm-logs/new" class="btn btn-primary btn-sm hidden sm:inline-flex" aria-label="New Log">New Log</a>
			<search class="no-script-hide w-full">
				<input type="text" placeholder="Search" bind:value={search} class="input input-bordered w-full sm:input-sm sm:max-w-xs" />
			</search>
			<a href="/dm-logs/new" class="btn btn-primary inline-flex sm:hidden" aria-label="New Log">
				<Icon src="plus" class="inline w-6" />
			</a>
		</div>
		<button
			class="no-script-hide btn btn-primary btn-sm"
			on:click={() => ($app.dmLogs.sort = $app.dmLogs.sort === "asc" ? "desc" : "asc")}
		>
			<Icon src="sort-calendar-{$app.dmLogs.sort}ending" class="w-6" />
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
								<th
									class={twMerge(
										"!static align-top",
										(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
											"print:border-b-0"
									)}
								>
									<p
										class="whitespace-pre-wrap font-semibold text-black dark:text-white"
										role="presentation"
										on:click={() => triggerModal(log)}
									>
										<SearchResults text={log.name} {search} />
									</p>
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
											<Items title="Magic Items" items={log.magic_items_gained} {search} sort />
										</div>
									</div>
								</th>
								<td
									class={twMerge(
										"hidden align-top sm:table-cell print:table-cell",
										(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
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
										(log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0) &&
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
									{#if log.magic_items_gained.length > 0}
										<div>
											<Items title="Magic Items" items={log.magic_items_gained} {search} sort />
										</div>
									{/if}
								</td>
								{#if hasStoryAwards}
									<td
										class={twMerge(
											"hidden align-top md:table-cell print:!hidden",
											(log.description?.trim() || log.story_awards_gained.length > 0) && "print:border-b-0"
										)}
									>
										{#if log.story_awards_gained.length > 0}
											<div>
												<Items items={log.story_awards_gained} {search} />
											</div>
										{/if}
									</td>
								{/if}
								<td class="w-8 align-top print:hidden">
									<div class="flex flex-col gap-2">
										<a href="/dm-logs/{log.id}" class="btn btn-primary sm:btn-sm" aria-label="Edit Log">
											<Icon src="pencil" class="w-4" />
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
												class="btn btn-error sm:btn-sm"
												on:click|preventDefault={(e) => {
													if (confirm(`Are you sure you want to delete ${log.name}? This action cannot be reversed.`))
														e.currentTarget.form?.requestSubmit();
												}}
												aria-label="Delete Log"
											>
												<Icon src="trash-can" class="w-4" />
											</button>
										</form>
									</div>
								</td>
							</tr>
							{#if log.description?.trim() || log.story_awards_gained.length > 0 || log.story_awards_lost.length > 0}
								<tr class={twMerge("hidden print:table-row", deletingLog.includes(log.id) && "hidden")}>
									<td colSpan={3} class="pt-0">
										<p class="text-sm">
											<span class="font-semibold">Notes:</span>
											{log.description}
										</p>
										{#if log.story_awards_gained.length > 0}
											<div>
												{#each log.story_awards_lost as mi}
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
