<script lang="ts">
	let { data } = $props();
</script>

<table class="linked-table bg-base-200 table w-full leading-5 max-sm:border-separate max-sm:border-spacing-y-2">
	<thead class="max-sm:hidden">
		<tr class="bg-base-300 text-base-content/70">
			<td>Label</td>
			<td>Level</td>
			<td>Timestamp</td>
			{#if !data.mobile}
				<td class="w-0"></td>
			{/if}
		</tr>
	</thead>
	{#each data.logs as log}
		<tbody class="border-t border-neutral-500/20 first:border-0">
			<tr class="border-0">
				<td>{log.message}</td>
				<td>{log.level}</td>
				<td>{log.timestamp.toLocaleString()}</td>
				{#if !data.mobile}
					<td>
						<button
							class="btn btn-sm btn-primary tooltip"
							data-tip="Toggle details"
							aria-label="Toggle details"
							onclick={() => {
								const details = document.querySelector(`tr[data-id="${log.id}"]`) as HTMLTableRowElement | null;
								if (details) details.dataset.details = details.dataset.details === "true" ? "false" : "true";
							}}
						>
							<span class="iconify mdi--eye"></span>
						</button>
					</td>
				{/if}
			</tr>
			<tr data-id={log.id} data-details={false} class="hidden data-[details=true]:table-row">
				<td colspan="4">
					<div class="grid grid-cols-1 gap-4">
						{#if log.trace}
							<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
								<h3 class="mb-2 text-lg font-bold">Trace</h3>
								<pre>{log.trace}</pre>
							</div>
						{/if}
						<div class="bg-base-100 overflow-x-scroll rounded-lg p-6">
							<h3 class="mb-2 text-lg font-bold">Annotations</h3>
							<pre>{JSON.stringify(log.annotations, null, 2)}</pre>
						</div>
					</div>
				</td>
			</tr>
		</tbody>
	{/each}
</table>
