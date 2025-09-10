<script lang="ts" module>
	import type { PageData } from "./$types.js";

	export const pageTitle = "DMs";
	export function getPageHead(data: Partial<PageData>) {
		return {
			title: `${data.user?.name}'s DMs`
		};
	}
</script>

<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import Breadcrumbs from "$lib/components/Breadcrumbs.svelte";
	import Search from "$lib/components/Search.svelte";
	import SearchResults from "$lib/components/SearchResults.svelte";
	import { EntitySearchFactory, successToast } from "$lib/factories.svelte.js";
	import DMsAPI from "$lib/remote/dms";
	import { parseEffectResult } from "$lib/util.js";
	import { sorter } from "@sillvva/utils";
	import { SvelteSet } from "svelte/reactivity";

	let { data } = $props();

	const search = $derived(new EntitySearchFactory(data.dms));
	const sortedResults = $derived(
		search.results.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(b.score, a.score) || sorter(a.name, b.name))
	);

	let deletingDM = new SvelteSet<string>();
</script>

<div class="flex flex-col gap-4">
	<Breadcrumbs />

	<div class="flex flex-col gap-4">
		<section class="flex max-sm:flex-1 sm:max-w-96">
			<Search bind:value={search.query} placeholder="Search" />
		</section>
		<section>
			<div class="bg-base-200 w-full overflow-x-auto rounded-lg">
				<table class="table w-full">
					<thead>
						<tr class="bg-base-300 text-base-content/70">
							<th class="max-sm:w-full">DM</th>
							<th class="max-xs:hidden">DCI</th>
							<th>Logs</th>
							<th class="print:hidden"></th>
						</tr>
					</thead>
					<tbody>
						{#if sortedResults.length == 0}
							<tr>
								<td colSpan={4} class="py-20 text-center">
									<p class="mb-4">You have no DMs.</p>
								</td>
							</tr>
						{:else}
							{#each sortedResults as dm (dm.id)}
								<tr class="data-[deleting=true]:hidden" data-deleting={deletingDM.has(dm.id)}>
									<td>
										<a
											href="/dms/{dm.id}"
											class="text-secondary-content text-left font-semibold whitespace-pre-wrap"
											aria-label="Edit DM"
										>
											<SearchResults text={dm.name} terms={search.terms} />
										</a>
										<div class="xs:hidden">
											{#if dm.DCI}
												<p class="text-xs text-gray-500">DCI: <SearchResults text={dm.DCI} terms={search.terms} /></p>
											{/if}
										</div>
									</td>
									<td class="max-xs:hidden"><SearchResults text={dm.DCI || ""} terms={search.terms} /></td>
									<td>{dm.logs.length}</td>
									<td class="w-16 print:hidden">
										<div class="flex flex-row justify-end gap-2">
											{#if dm.logs.length == 0 && !dm.isUser}
												<button
													type="button"
													class="btn btn-error sm:btn-sm touch-hitbox"
													aria-label="Delete DM"
													onclick={async () => {
														if (!confirm(`Are you sure you want to delete ${dm.name}? This action cannot be undone.`)) return;
														deletingDM.add(dm.id);
														const result = await DMsAPI.actions.delete(dm.id);
														const parsed = await parseEffectResult(result);
														if (parsed) {
															successToast(`${dm.name} deleted`);
															// TODO: Refresh dm query
															invalidateAll();
														} else {
															deletingDM.delete(dm.id);
														}
													}}
												>
													<span class="iconify mdi--trash-can"></span>
												</button>
											{/if}
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
