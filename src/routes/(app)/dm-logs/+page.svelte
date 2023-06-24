<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import Items from "$lib/components/Items.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import Meta from "$lib/components/Meta.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { formatDate } from "$lib/misc.js";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const logs = data.logs;

	let search = "";
	let modal: { name: string; description: string; date?: Date } | null = null;
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

	let stopWords = new Set(["and", "or", "to", "in", "a", "the"]);
	const dmLogSearch = new MiniSearch({
		fields: ["logName", "characterName", "magicItems", "storyAwards"],
		idField: "logId",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		searchOptions: {
			boost: { logName: 2 },
			prefix: true
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
					.sort((a, b) => a.date.getTime() - b.date.getTime())
			: logs.sort((a, b) => a.date.getTime() - b.date.getTime());
</script>

<Meta title="{data.session?.user?.name}'s DM Logs" />

<div class="flex flex-col gap-4">
	<div class="flex gap-4 print:hidden">
		<div class="breadcrumbs flex-1 text-sm">
			<ul>
				<li>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
						><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
					>
				</li>
				<li class="dark:drop-shadow-md">DM Logs</li>
			</ul>
		</div>
		{#if logs && logs.length > 0}
			<div class="flex flex-1 justify-end">
				<a href="/dm-logs/new" class="btn-primary btn-sm btn">New Log</a>
			</div>
		{/if}
		<div class="dropdown-end dropdown">
			<span role="button" tabindex="0" class="btn-sm btn">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
					><title>dots-horizontal</title><path
						fill="currentColor"
						d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
					/></svg
				>
			</span>
			<ul class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
				<li>
					<a download={`dm.json`} href={`/api/export/dm`} target="_blank" rel="noreferrer noopener">Export</a>
				</li>
			</ul>
		</div>
	</div>

	{#if form?.error}
		<div class="alert alert-error mb-4 shadow-lg">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
				><title>alert-circle</title><path
					fill="currentColor"
					d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"
				/></svg
			>
			{form.error}
		</div>
	{/if}

	<div class="flex gap-4">
		<input type="text" placeholder="Search" bind:value={search} class="input-bordered input input-sm w-full sm:max-w-xs" />
	</div>

	<section>
		<div class="w-full overflow-x-auto rounded-lg bg-base-100">
			<table class="table w-full">
				<thead>
					<tr class="bg-base-300">
						<th class="table-cell print:hidden sm:hidden">Game</th>
						<th class="hidden print:table-cell sm:table-cell">Title</th>
						<th class="hidden print:table-cell sm:table-cell">Advancement</th>
						<th class="hidden print:table-cell sm:table-cell">Treasure</th>
						<th class="hidden print:!hidden md:table-cell">Story Awards</th>
						<th class="print:hidden" />
					</tr>
				</thead>
				<tbody>
					{#if logs.length == 0}
						<tr>
							<td colSpan={5} class="py-20 text-center">
								<p class="mb-4">You have no DM logs.</p>
								<p>
									<a href="/dm-logs/new" class="btn-primary btn">Create one now</a>
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
									<p class="whitespace-pre-wrap font-semibold text-accent-content">
										<SearchResults text={log.name} {search} />
									</p>
									<p class="text-netural-content text-xs font-normal">{formatDate(log.date)}</p>
									{#if log.character}
										<p class="text-sm font-normal">
											<span class="font-semibold">Character:</span>
											<a href="/characters/{log.character.id}" class="text-secondary">
												<SearchResults text={log.character.name} {search} />
											</a>
										</p>
									{/if}
									<div class="table-cell font-normal print:hidden sm:hidden">
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
											<Items title="Magic Items" items={log.magic_items_gained} {search} />
										</div>
									</div>
								</th>
								<td
									class={twMerge(
										"hidden align-top print:table-cell sm:table-cell",
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
										"hidden align-top print:table-cell sm:table-cell",
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
											<Items title="Magic Items" items={log.magic_items_gained} {search} />
										</div>
									{/if}
								</td>
								<td
									class={twMerge(
										"hidden align-top print:!hidden md:table-cell",
										(log.description?.trim() || log.story_awards_gained.length > 0) && "print:border-b-0"
									)}
								>
									{#if log.story_awards_gained.length > 0}
										<div>
											<Items items={log.story_awards_gained} {search} />
										</div>
									{/if}
								</td>
								<td class="w-8 print:hidden">
									<div class="flex flex-col justify-center gap-2">
										<a href="/dm-logs/{log.id}" class="btn-primary btn-sm btn" aria-label="Edit Log">
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
												aria-label="Delete Log"
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

		<div
			role="presentation"
			class={twMerge("modal cursor-pointer", modal && "modal-open")}
			on:click={() => (modal = null)}
			on:keypress={() => null}
		>
			{#if modal}
				<div class="modal-box relative" role="presentation" on:click={(e) => e.stopPropagation()} on:keypress={() => null}>
					<h3 class="text-lg font-bold text-accent-content">{modal.name}</h3>
					{#if modal.date}
						<p class="text-xs">{modal.date.toLocaleString()}</p>
					{/if}
					<Markdown class="whitespace-pre-wrap pt-4 text-xs sm:text-sm" content={modal.description} />
				</div>
			{/if}
		</div>
	</section>
</div>
