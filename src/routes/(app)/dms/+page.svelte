<script lang="ts">
	import { applyAction, enhance } from "$app/forms";
	import { page } from "$app/stores";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { errorToast, successToast } from "$lib/factories";
	import { stopWords } from "$lib/util";
	import { sorter } from "@sillvva/utils";
	import MiniSearch from "minisearch";
	import { twMerge } from "tailwind-merge";
	import { searchData } from "../+layout.svelte";

	export let data;
	export let form;

	$: dms = data.dms;
	let deletingDM: string[] = [];
	let search = $page.url.searchParams.get("s") || "";

	const minisearch = new MiniSearch({
		fields: ["name", "DCI"],
		idField: "id",
		processTerm: (term) => (stopWords.has(term) ? null : term.toLowerCase()),
		tokenize: (term) => term.split(/[^A-Z0-9\.']/gi),
		searchOptions: {
			prefix: true,
			combineWith: "AND"
		}
	});

	$: indexed = dms
		? dms.map((dm) => ({
				id: dm.id,
				name: dm.name,
				DCI: dm.DCI
			}))
		: [];

	$: {
		minisearch.removeAll();
		minisearch.addAll(indexed);
	}
	$: msResults = minisearch.search(search);
	$: resultsMap = new Map(msResults.map((result) => [result.id, result]));
	$: results =
		indexed.length && search.length > 1
			? dms
					.filter((dm) => resultsMap.has(dm.id))
					.map((dm) => {
						const { score = dm.name, match = {} } = resultsMap.get(dm.id) || {};
						return {
							...dm,
							score: score,
							match: Object.values(match)
								.map((value) => value[0])
								.filter(Boolean)
						};
					})
					.sort((a, b) => sorter(b.uid || "", a.uid || "") || sorter(a.name, b.name))
			: dms
					.sort((a, b) => sorter(b.uid || "", a.uid || "") || sorter(a.name, b.name))
					.map((dm) => ({ ...dm, score: 0, match: [] }));
</script>

<div class="flex flex-col gap-4">
	<BreadCrumbs />

	<div class="flex flex-col gap-4">
		<section class="flex max-w-96">
			<Search bind:value={search} placeholder="Search" />
		</section>
		<section>
			<div class="w-full overflow-x-auto rounded-lg bg-base-200">
				<table class="table w-full">
					<thead>
						<tr class="bg-base-300 text-base-content/70">
							<th class="">DM</th>
							<th class="hidden xs:table-cell">DCI</th>
							<th class="hidden xs:table-cell">Logs</th>
							<th class="print:hidden" />
						</tr>
					</thead>
					<tbody>
						{#if !dms || dms.length == 0}
							<tr>
								<td colSpan={4} class="py-20 text-center">
									<p class="mb-4">You have no DMs.</p>
								</td>
							</tr>
						{:else}
							{#each results as dm}
								<tr class={twMerge(deletingDM.includes(dm.id) && "hidden")}>
									<td>
										<SearchResults text={dm.name} {search} />
										<div class="block xs:hidden">
											{#if dm.DCI}
												<p class="text-xs text-gray-500">DCI: <SearchResults text={dm.DCI} {search} /></p>
											{/if}
											<p class="text-xs text-gray-500">{dm.logs.length} logs</p>
										</div>
									</td>
									<td class="hidden xs:table-cell"><SearchResults text={dm.DCI || ""} {search} /></td>
									<td class="hidden xs:table-cell">{dm.logs.length}</td>
									<td class="w-16 print:hidden">
										<div class="flex flex-row justify-end gap-2">
											{#if dm.logs.length == 0}
												<form
													method="POST"
													action={`?/deleteDM`}
													use:enhance={({ cancel }) => {
														if (!confirm(`Are you sure you want to delete ${dm.name}? This action cannot be reversed.`))
															return cancel();

														deletingDM = [...deletingDM, dm.id];
														return async ({ result }) => {
															await applyAction(result);
															if (form?.error) {
																errorToast(form.error);
																deletingDM = deletingDM.filter((id) => id !== dm.id);
															} else {
																successToast(`${dm.name} deleted`);
																$searchData = [];
															}
														};
													}}
												>
													<input type="hidden" name="dmId" value={dm.id} />
													<button type="submit" class="btn btn-error sm:btn-sm" aria-label="Delete DM">
														<span class="iconify mdi-[trash-can] size-4" />
													</button>
												</form>
											{/if}
											<a href="/dms/{dm.id}" class="btn btn-primary sm:btn-sm" aria-label="Edit DM">
												<span class="iconify mdi-[pencil] size-4" />
											</a>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</div>
