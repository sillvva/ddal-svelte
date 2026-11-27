<script lang="ts">
	import Error from "#lib/components/error.svelte";
	import Control from "#lib/components/forms/control.svelte";
	import Input from "#lib/components/forms/input.svelte";
	import RemoteForm from "#lib/components/forms/remote-form.svelte";
	import Submit from "#lib/components/forms/submit.svelte";
	import Head from "#lib/components/head.svelte";
	import Link from "#lib/components/link.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { successToast } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { parseEffectResult } from "#lib/util.js";
	import { goto } from "$app/navigation";
	import { resolve } from "$app/paths";

	let { params } = $props();

	const global = getGlobal();
</script>

<svelte:boundary>
	{const dm = $derived(await API.dms.queries.get(params.dmId))}
	{const data = $derived({
		id: dm.id,
		name: dm.name,
		DCI: dm.DCI || ""
	})}

	{#snippet failed(error)}<Error {error} boundary="edit-dm" />{/snippet}

	<Head title={dm.name} />

	<NavMenu
		crumbs={[
			{ title: "DMs", href: "dms" },
			{ title: dm.name, href: "/(app)/dms/[dmId=DMId]", params: { dmId: dm.id } }
		]}
	/>

	<RemoteForm form={API.dms.forms.save} {data} initialErrors>
		{#snippet children(ctx)}
			{const { form } = $derived(ctx)}
			<Input field={form.fields.id} type="hidden" />
			<Control class="col-span-12 sm:col-span-6">
				<Input field={form.fields.name} label="DM Name" required />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<Input field={form.fields.DCI} label="DCI" />
			</Control>
			<div class="col-span-12 my-4 flex justify-center">
				<Submit form={ctx}>Save DM</Submit>
			</div>
		{/snippet}
	</RemoteForm>

	<section class="mt-4">
		<h2 class="mb-2 text-2xl">Logs</h2>
		{#if dm.logs.length == 0}
			<div class="flex h-40 flex-col items-center justify-center gap-2 rounded-lg bg-base-200">
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
							goto(resolve("dms"));
						}
						global.pageLoader = false;
					}}
				>
					<span class="iconify mdi--trash-can"></span>
				</button>
			</div>
		{:else}
			<div class="w-full overflow-x-auto rounded-lg bg-base-100">
				<table class="table w-full bg-base-200">
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
							{#snippet logLink()}
								{#if log.isDmLog}
									<Link href="/(app)/dm-logs/[logId=LogId]" params={{ logId: log.id }} class="text-secondary lg:hidden">
										{log.name}
									</Link>
								{:else if log.character?.id}
									<Link
										href="/(app)/characters/[characterId=CharacterId]/log/[logId=LogId]"
										params={{ characterId: log.character.id, logId: log.id }}
										class="text-secondary lg:hidden"
									>
										{log.name}
									</Link>
								{:else}
									{log.name}
								{/if}
							{/snippet}
							<tr>
								<td class="max-xs:px-2">
									<div class="flex flex-col gap-1">
										{@render logLink()}
										<div class="min-w-max">
											{new Date(log.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
										</div>
										<div class="min-w-max md:hidden">{log.isDmLog ? "DM Log" : "Log"} ({log.type})</div>
									</div>
								</td>
								<td class="max-lg:hidden">
									{@render logLink()}
								</td>
								<td class="max-xs:px-2">
									{#if log.character?.name && log.character?.id}
										<Link
											href="/(app)/characters/[characterId=CharacterId]"
											params={{ characterId: log.character.id }}
											class="text-secondary"
										>
											{log.character?.name}
										</Link>
									{/if}
								</td>
								{#if dm.isUser}
									<td class="max-md:hidden">
										<div class="min-w-max">
											{log.isDmLog ? "DM Log" : "Log"}{#if !log.isDmLog}
												&nbsp;({log.type}){/if}
										</div>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</svelte:boundary>
