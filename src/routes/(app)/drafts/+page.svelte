<script lang="ts">
	import Head from "#lib/components/head.svelte";
	import LogDraftFaq from "#lib/components/log-draft-faq.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { successToast } from "#lib/factories.svelte.js";
	import { logDraftMemory } from "#lib/log-draft-storage.svelte.js";
	import { LOG_DRAFT_TTL_MS, logDraftPath } from "#lib/log-draft.js";
	import * as API from "#lib/remote/index.js";
	import type { LogDraftId } from "#lib/schemas.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { formatDate, parseEffectResult } from "#lib/util.js";
	import { page } from "$app/state";
	import { clipboard } from "@svelteuidev/composables";
	import { fromAction } from "svelte/attachments";
	import { SvelteSet } from "svelte/reactivity";

	const DAY_MS = 24 * 60 * 60 * 1000;
	const TTL_DAYS = LOG_DRAFT_TTL_MS / DAY_MS;

	const global = getGlobal();
	let deletingDraft = new SvelteSet<LogDraftId>();

	function daysLeft(expiresAt: number) {
		return Math.max(0, Math.ceil((expiresAt - Date.now()) / DAY_MS));
	}

	async function deleteDraft(draft: { id: LogDraftId; name: string }) {
		if (!confirm(`Delete ${draft.name || "this draft"}? The link will stop working.`)) return;
		deletingDraft.add(draft.id);
		const result = await API.drafts.actions.remove(draft.id);
		const removed = await parseEffectResult(result);
		if (!removed) {
			deletingDraft.delete(draft.id);
			return;
		}
		const memory = logDraftMemory();
		if (memory.current?.id === draft.id) memory.clear();
		successToast(`${draft.name || "Draft"} deleted`);
	}
</script>

<svelte:boundary>
	{const { user } = $derived(await API.app.queries.request())}
	{const { drafts, limit } = $derived(await API.drafts.queries.getAll())}
	{const visible = $derived(drafts.filter((draft) => !deletingDraft.has(draft.id)))}
	{const atLimit = $derived(visible.length >= limit)}

	<Head title="{user?.name}'s Drafts" />

	<NavMenu base crumbs={[{ title: "Drafts", url: "/drafts" }]} />

	<div class="flex items-center justify-between gap-2">
		{#if atLimit}
			<button type="button" class="btn btn-primary sm:btn-sm" disabled>New Player Draft</button>
		{:else}
			<a href="/drafts/new" class="btn btn-primary sm:btn-sm">New Player Draft</a>
		{/if}
		<p class="text-sm">
			<span class={["font-semibold", atLimit && "text-error"]}>{visible.length} / {limit}</span>
			drafts
		</p>
	</div>

	<p class="alert flex items-start gap-4 bg-base-300 text-sm leading-6">
		<span class="mt-0.5 iconify size-5 mdi--info-circle-outline"></span>
		<span class="flex-1">
			Drafts expire automatically {TTL_DAYS} days after they were last saved. Saving a draft again restarts the {TTL_DAYS} days.
			{#if atLimit}
				You have reached the limit. Delete a draft before creating another.
			{/if}
		</span>
	</p>

	<section>
		<div class="w-full overflow-x-auto rounded-lg bg-base-200">
			<table class="linked-table table w-full">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th class="max-sm:w-full">Draft</th>
						<th class="max-xs:hidden">For</th>
						<th class="max-sm:hidden">Last Saved</th>
						<th class="max-sm:hidden">Expires</th>
						<th class="print:hidden"></th>
					</tr>
				</thead>
				<tbody>
					{#if visible.length == 0}
						<tr>
							<td colSpan={5} class="py-20 text-center">
								<p class="mb-4">You have no drafts.</p>
								<a href="/drafts/new" class="btn btn-primary">Create one now</a>
							</td>
						</tr>
					{:else}
						{#each visible as draft (draft.id)}
							{const remaining = $derived(daysLeft(draft.expiresAt))}
							<tr>
								<td>
									<a
										href="/drafts/{draft.id}"
										class="row-link text-left font-semibold whitespace-pre-wrap text-secondary"
										aria-label="Edit {draft.name || 'Untitled draft'}"
									>
										{draft.name || "Untitled draft"}
									</a>
									{#if draft.type === "nongame"}
										<p class="text-xs">Non-Game</p>
									{/if}
									<p class="text-xs sm:hidden">
										Expires {formatDate(new Date(draft.expiresAt), global.app.settings.timezone)}
									</p>
								</td>
								<td class="max-xs:hidden">
									<span class={["badge badge-sm", draft.kind === "dm" ? "badge-secondary" : "badge-primary"]}>
										{draft.kind === "dm" ? "DM Log" : "Player Log"}
									</span>
								</td>
								<td class="whitespace-nowrap max-sm:hidden">
									{formatDate(draft.updatedAt, global.app.settings.timezone)}
								</td>
								<td class="whitespace-nowrap max-sm:hidden">
									<p>{formatDate(new Date(draft.expiresAt), global.app.settings.timezone)}</p>
									<p class={["text-xs", remaining <= 2 && "font-semibold text-warning"]}>
										{remaining === 1 ? "1 day left" : `${remaining} days left`}
									</p>
								</td>
								<td class="w-16 print:hidden">
									<div class="flex flex-row justify-end gap-2">
										<button
											type="button"
											class="btn touch-hitbox sm:btn-sm"
											aria-label="Copy link"
											title="Copy link"
											onclick={() => successToast("Draft link copied")}
											{@attach fromAction(clipboard, () => `${page.url.origin}${logDraftPath(draft.id)}`)}
										>
											<span class="iconify mdi--link-variant"></span>
										</button>
										<button
											type="button"
											class="btn touch-hitbox btn-error sm:btn-sm"
											aria-label="Delete Draft"
											onclick={() => deleteDraft(draft)}
										>
											<span class="iconify mdi--trash-can"></span>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<div class="mt-8">
		<LogDraftFaq />
	</div>
</svelte:boundary>
