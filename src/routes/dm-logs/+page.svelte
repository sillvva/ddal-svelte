<script lang="ts">
	export let data;

	const logs = data.logs;
</script>

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
			<span tabIndex={1} class="btn-sm btn">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
					><title>dots-horizontal</title><path
						fill="currentColor"
						d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
					/></svg
				>
			</span>
			<ul tabIndex={1} class="dropdown-content menu rounded-box w-52 bg-base-100 p-2 shadow">
				<li>
					<a download={`dm.json`} href={`/api/exports/dm`} target="_blank" rel="noreferrer noopener">Export</a>
				</li>
			</ul>
		</div>
	</div>

	{JSON.stringify(logs)}
</div>
