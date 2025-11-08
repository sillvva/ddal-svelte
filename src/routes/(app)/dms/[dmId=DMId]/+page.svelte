<script lang="ts">
	import { goto } from "$app/navigation";
	import Control from "$lib/components/forms/control.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import RemoteInput from "$lib/components/forms/remote-input.svelte";
	import RemoteSubmit from "$lib/components/forms/remote-submit.svelte";
	import Head from "$lib/components/head.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import { successToast } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { dungeonMasterFormSchema } from "$lib/schemas.js";
	import { getGlobal } from "$lib/stores.svelte.js";
	import { parseEffectResult } from "$lib/util";

	let { params } = $props();

	const global = getGlobal();

	const schema = dungeonMasterFormSchema;
	const form = API.dms.forms.save;
	const data = $derived(await API.dms.forms.get(params.dmId));
	const dm = $derived(await API.dms.queries.get(params.dmId));
</script>

<Head title={dm.name} />

<NavMenu
	crumbs={[
		{ title: "DMs", url: "/dms" },
		{ title: dm.name, url: `/dms/${dm.id}` }
	]}
/>

<RemoteForm {schema} {form} {data}>
	{#snippet children({ fields })}
		<RemoteInput field={fields.id} type="hidden" />
		<Control class="col-span-12 sm:col-span-6">
			<RemoteInput field={fields.name} type="text" label="DM Name" required />
		</Control>
		<Control class="col-span-12 sm:col-span-6">
			<RemoteInput field={fields.DCI} type="text" label="DCI" />
		</Control>
		<div class="col-span-12 my-4 flex justify-center">
			<RemoteSubmit>Save DM</RemoteSubmit>
		</div>
	{/snippet}
</RemoteForm>

<section class="mt-r sm:mt-8">
	<h2 class="mb-2 text-2xl">Logs</h2>
	{#if dm.logs.length == 0}
		<div class="bg-base-200 flex h-40 flex-col items-center justify-center gap-2 rounded-lg">
			<p>This DM has no logs.</p>
			<button
				type="button"
				class="btn btn-error sm:btn-sm"
				aria-label="Delete DM"
				disabled={!!API.dms.actions.deleteDM.pending}
				onclick={async () => {
					if (!confirm(`Are you sure you want to delete ${dm.name}? This action cannot be undone.`)) return;
					global.pageLoader = true;
					const result = await API.dms.actions.deleteDM(dm.id);
					const parsed = await parseEffectResult(result);
					if (parsed) {
						successToast(`${dm.name} deleted`);
						goto("/dms");
					}
					global.pageLoader = false;
				}}
			>
				<span class="iconify mdi--trash-can"></span>
			</button>
		</div>
	{:else}
		<div class="bg-base-100 w-full overflow-x-auto rounded-lg">
			<table class="bg-base-200 table w-full">
				<thead>
					<tr class="bg-base-300">
						<th class="max-lg:hidden">Date</th>
						<th class="max-xs:px-2">Adventure</th>
						<th class="max-xs:px-2">Character</th>
						{#if dm.isUser}
							<th class="max-md:hidden">Type</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each dm.logs as log (log.id)}
						<tr>
							<td class="max-xs:px-2">
								<div class="flex flex-col gap-1">
									<a href={`/characters/${log.character?.id}/log/${log.id}`} class="text-secondary-content lg:hidden">
										{log.name}
									</a>
									<div class="min-w-max">
										{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
									</div>
									<div class="min-w-max md:hidden">{log.isDmLog ? "DM Log" : "Log"} ({log.type})</div>
								</div>
							</td>
							<td class="max-lg:hidden">
								<a
									href={log.isDmLog ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`}
									class="text-secondary-content"
								>
									{log.name}
								</a>
							</td>
							<td class="max-xs:px-2">
								{#if log.character?.name}
									<a href={`/characters/${log.character?.id}?s=${log.id}`} class="text-secondary-content">
										{log.character?.name}
									</a>
								{/if}
							</td>
							{#if dm.isUser}
								<td class="max-md:hidden">
									<div class="min-w-max">{log.isDmLog ? "DM Log" : "Log"} ({log.type})</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
