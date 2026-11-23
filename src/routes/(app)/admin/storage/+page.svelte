<script lang="ts">
	import {
		formatAge,
		formatExactBytes,
		matchesOrphanSweepConfirmation,
		orphanSweepConfirmationPhrase
	} from "#lib/admin-storage.js";
	import { hotkey } from "#lib/attachments.js";
	import Head from "#lib/components/head.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { errorToast, successToast } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { formatDate, parseEffectResult } from "#lib/util.js";
	import { SvelteSet } from "svelte/reactivity";

	type ScanResult = Extract<Awaited<ReturnType<typeof API.admin.actions.scanOrphanedObjects>>, { ok: true }>["data"];
	type SweepDeleteResult = Extract<Awaited<ReturnType<typeof API.admin.actions.deleteOrphanedObjects>>, { ok: true }>["data"];

	const global = getGlobal();
	const timezone = $derived(global.app.settings.timezone);

	const queue = $derived(await API.admin.queries.getPendingDeletions());

	let purging = $state(false);
	const busyKeys = new SvelteSet<string>();

	let scanning = $state(false);
	let deletingOrphans = $state(false);
	let scan = $state.raw<ScanResult | null>(null);
	let lastSweepResult = $state.raw<SweepDeleteResult | null>(null);
	let orphanFilter = $state("");
	let confirmOpen = $state(false);
	let confirmInput = $state("");

	const filteredOrphans = $derived.by(() => {
		if (!scan) return [];
		const q = orphanFilter.trim().toLowerCase();
		if (!q) return scan.orphans;
		return scan.orphans.filter((item) => item.key.toLowerCase().includes(q));
	});

	const expectedConfirmation = $derived(scan ? orphanSweepConfirmationPhrase(scan.bucket, scan.orphans.length) : "");
	const sweepConfirmed = $derived(scan ? matchesOrphanSweepConfirmation(scan.bucket, scan.orphans.length, confirmInput) : false);

	function focusInput(node: HTMLInputElement) {
		node.focus();
	}

	async function purgeNow() {
		if (purging) return;
		purging = true;
		try {
			const result = await API.admin.actions.purgePendingDeletions();
			const parsed = await parseEffectResult(result);
			if (!parsed) return;

			if (parsed.before === 0) {
				successToast("Deletion queue is already empty");
			} else if (parsed.remaining === 0) {
				successToast(`Purged ${parsed.purged} queued object${parsed.purged === 1 ? "" : "s"}`);
			} else if (parsed.purged > 0) {
				successToast(`Purged ${parsed.purged} object${parsed.purged === 1 ? "" : "s"}; ${parsed.remaining} still pending`);
			} else {
				errorToast(`Could not purge ${parsed.remaining} pending object${parsed.remaining === 1 ? "" : "s"}`);
			}
		} finally {
			purging = false;
		}
	}

	async function retryRow(objectKey: string) {
		if (purging || busyKeys.has(objectKey)) return;
		busyKeys.add(objectKey);
		try {
			const result = await API.admin.actions.retryPendingDeletion({ objectKey });
			const parsed = await parseEffectResult(result);
			if (!parsed) return;

			switch (parsed.status) {
				case "deleted":
					successToast("Deleted object and removed from queue");
					break;
				case "in-use":
					successToast("Object is still referenced; removed from queue without deleting");
					break;
				case "dropped-invalid":
					successToast("Removed non-permanent key from queue");
					break;
				case "missing":
					successToast("Row was already removed from queue");
					break;
				case "failed":
					errorToast(`Retry failed: ${parsed.message}`);
					break;
			}
		} finally {
			busyKeys.delete(objectKey);
		}
	}

	async function removeRow(objectKey: string) {
		if (purging || busyKeys.has(objectKey)) return;
		if (!confirm("Remove this row from the pending deletion queue? The object in R2 will NOT be deleted.")) return;
		busyKeys.add(objectKey);
		try {
			const result = await API.admin.actions.removePendingDeletion({ objectKey });
			const parsed = await parseEffectResult(result);
			if (!parsed) return;
			successToast(parsed.removed ? "Removed row from deletion queue" : "Row was already removed");
		} finally {
			busyKeys.delete(objectKey);
		}
	}

	async function runDryRun() {
		if (scanning || deletingOrphans) return;
		scanning = true;
		try {
			const result = await API.admin.actions.scanOrphanedObjects();
			const parsed = await parseEffectResult(result);
			if (!parsed) return;

			scan = parsed;
			lastSweepResult = null;
			orphanFilter = "";
			confirmOpen = false;
			confirmInput = "";
		} finally {
			scanning = false;
		}
	}

	function openConfirm() {
		if (!scan || !scan.orphans.length) return;
		confirmInput = "";
		confirmOpen = true;
	}

	function closeConfirm() {
		if (deletingOrphans) return;
		confirmOpen = false;
		confirmInput = "";
	}

	async function submitOrphanDelete(event: SubmitEvent) {
		event.preventDefault();
		if (!scan || !sweepConfirmed || deletingOrphans) return;

		deletingOrphans = true;
		try {
			const result = await API.admin.actions.deleteOrphanedObjects({
				keys: scan.orphans.map((object) => object.key),
				token: scan.token,
				issuedAt: scan.issuedAt,
				confirmation: confirmInput
			});
			const parsed = await parseEffectResult(result);
			if (!parsed) return;

			lastSweepResult = parsed;
			scan = null;
			confirmOpen = false;
			confirmInput = "";

			if (parsed.failedCount > 0) {
				errorToast(
					`Deleted ${parsed.deletedCount}, skipped ${parsed.skippedCount}, failed ${parsed.failedCount} object${parsed.failedCount === 1 ? "" : "s"}`
				);
			} else if (parsed.skippedCount > 0) {
				successToast(
					`Deleted ${parsed.deletedCount} orphaned object${parsed.deletedCount === 1 ? "" : "s"}; skipped ${parsed.skippedCount} newly referenced`
				);
			} else {
				successToast(`Deleted ${parsed.deletedCount} orphaned object${parsed.deletedCount === 1 ? "" : "s"}`);
			}
		} finally {
			deletingOrphans = false;
		}
	}
</script>

<Head title="Storage" />

<NavMenu base crumbs={[{ title: "Storage", href: "admin/storage" }]} />

<section class="flex flex-wrap items-center justify-between gap-2">
	<h1 class="text-xl font-bold">Storage</h1>
	<span class="badge bg-base-300 font-mono text-xs text-base-content">bucket: {queue.bucket}</span>
</section>

<section class="rounded-lg bg-base-200 p-4">
	<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
		<div>
			<h2 class="flex items-center gap-2 font-semibold">
				Pending object deletions
				<span class="badge bg-base-300 badge-sm text-base-content">{queue.items.length}</span>
			</h2>
			<p class="mt-0.5 text-xs text-base-content/70">
				Queued permanent R2 keys waiting for deletion. Purge runs after some saves and deletes, never on a schedule, so failed
				deletes stay here until retried or removed.
			</p>
		</div>
		<button type="button" class="btn btn-primary btn-sm" disabled={purging || queue.items.length === 0} onclick={purgeNow}>
			{#if purging}
				<span class="iconify animate-spin mdi--loading"></span>
			{:else}
				<span class="iconify mdi--delete-sweep"></span>
			{/if}
			Purge now
		</button>
	</div>

	{#if queue.items.length}
		<div class="overflow-x-auto rounded-lg bg-base-100/50">
			<table class="table table-sm">
				<thead>
					<tr class="bg-base-300 text-base-content/70">
						<th>Object key</th>
						<th class="whitespace-nowrap">Age</th>
						<th class="text-center whitespace-nowrap">Attempts</th>
						<th class="w-0 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each queue.items as row (row.id)}
						{@const rowBusy = purging || busyKeys.has(row.objectKey)}
						<tr>
							<td class="font-mono text-xs break-all">
								{row.objectKey}
								<div class="mt-0.5 font-sans text-base-content/60 sm:hidden">
									Queued {formatDate(row.createdAt, timezone)}
								</div>
							</td>
							<td class="whitespace-nowrap">
								<span class="sm:tooltip" data-tip={formatDate(row.createdAt, timezone)}>
									{formatAge(row.createdAt)}
								</span>
							</td>
							<td class="text-center whitespace-nowrap">
								<span
									class={[
										"badge font-mono badge-sm",
										row.attempts >= 3 ? "badge-error" : row.attempts > 0 ? "badge-warning" : "bg-base-300"
									]}
								>
									{row.attempts}
								</span>
							</td>
							<td>
								<div class="flex justify-end gap-1.5">
									<div class="sm:tooltip sm:tooltip-left" data-tip="Retry deleting from R2">
										<button
											type="button"
											class="btn btn-primary btn-xs"
											aria-label="Retry {row.objectKey}"
											disabled={rowBusy}
											onclick={() => retryRow(row.objectKey)}
										>
											{#if busyKeys.has(row.objectKey)}
												<span class="iconify animate-spin mdi--loading"></span>
											{:else}
												<span class="iconify mdi--refresh"></span>
											{/if}
											<span class="max-sm:hidden">Retry</span>
										</button>
									</div>
									<div class="sm:tooltip sm:tooltip-left" data-tip="Remove stuck row (keeps R2 object)">
										<button
											type="button"
											class="btn btn-error btn-xs"
											aria-label="Remove {row.objectKey}"
											disabled={rowBusy}
											onclick={() => removeRow(row.objectKey)}
										>
											<span class="iconify mdi--close"></span>
											<span class="max-sm:hidden">Remove</span>
										</button>
									</div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="flex h-24 items-center justify-center rounded-lg bg-base-100/50 text-sm text-base-content/60">
			No pending object deletions
		</div>
	{/if}
</section>

<section class="rounded-lg bg-base-200 p-4">
	<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
		<div>
			<h2 class="font-semibold">Orphaned R2 object sweep</h2>
			<p class="mt-0.5 text-xs text-base-content/70">
				Lists permanent keys in <span class="font-mono">{queue.bucket}</span> not referenced by
				<span class="font-mono">character.image_url</span>, <span class="font-mono">user.image</span>,
				<span class="font-mono">image_upload.object_key</span>, or <span class="font-mono">pending_object_deletion</span>. Skips
				<span class="font-mono">tmp/</span>. Dry run by default; manual only.
			</p>
		</div>
		<button type="button" class="btn btn-primary btn-sm" disabled={scanning || deletingOrphans} onclick={runDryRun}>
			{#if scanning}
				<span class="iconify animate-spin mdi--loading"></span>
				Scanning…
			{:else}
				<span class="iconify mdi--magnify"></span>
				{scan ? "Re-scan (dry run)" : "Run dry run"}
			{/if}
		</button>
	</div>

	{#if lastSweepResult}
		<div class={["mb-3 alert text-sm", lastSweepResult.failedCount > 0 ? "alert-warning" : "alert-success"]}>
			<div class="flex flex-col gap-1">
				<div class="font-semibold">
					Sweep complete on <span class="font-mono">{lastSweepResult.bucket}</span>: deleted {lastSweepResult.deletedCount} of
					{lastSweepResult.requestedCount} object{lastSweepResult.requestedCount === 1 ? "" : "s"}
					{#if lastSweepResult.skippedCount > 0}
						({lastSweepResult.skippedCount} skipped because referenced)
					{/if}
					{#if lastSweepResult.failedCount > 0}
						({lastSweepResult.failedCount} failed)
					{/if}
				</div>
				{#if lastSweepResult.errors.length}
					<ul class="list-inside list-disc font-mono text-xs">
						{#each lastSweepResult.errors.slice(0, 20) as err, i (i)}
							<li>{err.key || "(unknown key)"} — {err.code}: {err.message}</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/if}

	{#if scan}
		<div class="mb-3 grid gap-2 rounded-lg bg-base-100/60 p-3 text-sm sm:grid-cols-4">
			<div>
				<div class="text-xs text-base-content/60">Bucket</div>
				<div class="font-mono font-semibold">{scan.bucket}</div>
			</div>
			<div>
				<div class="text-xs text-base-content/60">Permanent objects scanned</div>
				<div class="font-semibold">{scan.scannedPermanentCount.toLocaleString()}</div>
			</div>
			<div>
				<div class="text-xs text-base-content/60">Orphaned objects</div>
				<div class={["font-semibold", scan.orphans.length > 0 && "text-warning"]}>
					{scan.orphans.length.toLocaleString()}
				</div>
			</div>
			<div>
				<div class="text-xs text-base-content/60">Total orphaned size</div>
				<div class="font-semibold" title="{scan.totalBytes.toLocaleString()} bytes">
					{formatExactBytes(scan.totalBytes)}
					<span class="block font-mono text-xs font-normal text-base-content/60">
						{scan.totalBytes.toLocaleString()} B
					</span>
				</div>
			</div>
		</div>

		{#if scan.orphans.length}
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<input
					type="search"
					class="input w-full input-sm sm:max-w-xs"
					placeholder="Filter listed keys…"
					aria-label="Filter orphaned keys"
					bind:value={orphanFilter}
				/>
				<div class="flex items-center gap-2">
					<span class="text-xs text-base-content/60">
						Scanned {formatDate(scan.scannedAt, timezone)}
					</span>
					<button type="button" class="btn btn-error btn-sm" disabled={scanning || deletingOrphans} onclick={openConfirm}>
						<span class="iconify mdi--delete-alert"></span>
						Delete {scan.orphans.length.toLocaleString()} orphaned object{scan.orphans.length === 1 ? "" : "s"}…
					</button>
				</div>
			</div>

			<div class="max-h-96 overflow-auto rounded-lg bg-base-100/50">
				<table class="table-pin-rows table table-sm">
					<thead>
						<tr class="bg-base-300 text-base-content/70">
							<th>Object key</th>
							<th class="text-right whitespace-nowrap">Size</th>
							<th class="whitespace-nowrap">Last modified</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredOrphans as obj (obj.key)}
							<tr>
								<td class="font-mono text-xs break-all">{obj.key}</td>
								<td class="text-right font-mono text-xs whitespace-nowrap" title="{obj.bytes.toLocaleString()} bytes">
									{formatExactBytes(obj.bytes)}
								</td>
								<td class="text-xs whitespace-nowrap">
									{obj.lastModified ? formatDate(obj.lastModified, timezone) : "-"}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="3" class="py-6 text-center text-sm text-base-content/60">
									No keys match "{orphanFilter}"
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="flex h-24 flex-col items-center justify-center rounded-lg bg-base-100/50 text-sm text-base-content/70">
				<div>No orphaned permanent objects found in <span class="font-mono">{scan.bucket}</span>.</div>
				<div class="mt-0.5 text-xs text-base-content/50">Scanned {formatDate(scan.scannedAt, timezone)}</div>
			</div>
		{/if}
	{:else if !lastSweepResult}
		<div class="flex h-24 items-center justify-center rounded-lg bg-base-100/50 text-sm text-base-content/60">
			Run a dry run to inspect orphaned permanent objects before deleting anything.
		</div>
	{/if}
</section>

{#if confirmOpen && scan}
	<dialog
		class="modal bg-base-300/25!"
		open
		aria-labelledby="confirm-orphan-delete-title"
		aria-describedby="confirm-orphan-delete-description"
		{@attach hotkey([["Escape", closeConfirm]])}
	>
		<div class="relative modal-box cursor-default bg-base-100 drop-shadow-lg">
			<button
				type="button"
				class="btn absolute top-2 right-2 btn-circle btn-ghost btn-sm"
				onclick={closeConfirm}
				aria-label="Close"
				disabled={deletingOrphans}
			>
				<span class="iconify mdi--close"></span>
			</button>
			<form class="flex flex-col gap-3" onsubmit={submitOrphanDelete}>
				<h3 id="confirm-orphan-delete-title" class="pr-8 text-lg font-bold text-base-content">
					Delete {scan.orphans.length.toLocaleString()} orphaned object{scan.orphans.length === 1 ? "" : "s"}
				</h3>
				<p id="confirm-orphan-delete-description" class="text-sm">
					This permanently deletes up to <strong>{scan.orphans.length.toLocaleString()}</strong> object{scan.orphans.length === 1
						? ""
						: "s"} ({formatExactBytes(scan.totalBytes)}) from <span class="font-mono font-semibold">{scan.bucket}</span> in batches
					of up to 1,000. Only keys from this dry run are eligible, and each batch is re-checked against the database right before deleting.
				</p>
				<p class="text-xs text-base-content/70">
					Type <span class="font-mono font-semibold text-error">{expectedConfirmation}</span> to confirm:
				</p>
				<label class="flex flex-col gap-1">
					<span class="text-xs font-medium">Confirmation</span>
					<input
						type="text"
						class="input w-full font-mono max-sm:text-base"
						bind:value={confirmInput}
						{@attach focusInput}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						placeholder={expectedConfirmation}
						disabled={deletingOrphans}
					/>
				</label>
				<div class="modal-action">
					<button type="button" class="btn" onclick={closeConfirm} disabled={deletingOrphans}>Cancel</button>
					<button type="submit" class="btn btn-error" disabled={!sweepConfirmed || deletingOrphans}>
						{#if deletingOrphans}
							<span class="iconify size-5 animate-spin mdi--loading"></span>
						{/if}
						Delete orphaned objects
					</button>
				</div>
			</form>
		</div>
		<button type="button" class="modal-backdrop" onclick={closeConfirm} aria-label="Close">✕</button>
	</dialog>
{/if}
