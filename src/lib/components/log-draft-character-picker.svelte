<script lang="ts">
	import Link from "#lib/components/link.svelte";
	import { characterNewLogFromDraftPath } from "#lib/log-draft.js";
	import { readLastLogDraftCharacterId, saveLastLogDraftCharacterId } from "#lib/log-draft.svelte.js";
	import type { FullCharacterData } from "#lib/server/effect/services/characters.js";
	import type { CharacterId } from "#lib/schemas.js";
	import { onMount } from "svelte";

	interface Props {
		characters: FullCharacterData[];
	}

	let { characters }: Props = $props();

	const sorted = $derived(characters.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));

	let selectedId = $state<CharacterId | "">("");

	const selected = $derived(sorted.find((character) => character.id === selectedId));
	const targetPath = $derived(selected ? characterNewLogFromDraftPath(selected) : null);

	function defaultSelection(list: FullCharacterData[]) {
		if (!list.length) return "";
		const remembered = readLastLogDraftCharacterId();
		if (remembered && list.some((character) => character.id === remembered)) return remembered;
		return list[0]?.id ?? "";
	}

	onMount(() => {
		selectedId = defaultSelection(sorted);
	});

	function remember() {
		if (!selectedId) return;
		saveLastLogDraftCharacterId(selectedId);
	}
</script>

{#if !characters.length}
	<p>
		<Link href="characters/new/edit" class="link link-primary">Create a character</Link>
		to start a log from this draft.
	</p>
{:else}
	<form
		class="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-200 p-4"
		onsubmit={(event) => {
			event.preventDefault();
			remember();
			if (targetPath) window.location.assign(targetPath);
		}}
	>
		<label class="form-control w-full gap-1">
			<span class="label-text font-semibold">Character</span>
			<select class="select-bordered select w-full max-sm:text-base" bind:value={selectedId} required aria-label="Character">
				{#each sorted as character (character.id)}
					<option value={character.id}>
						{character.name}
						{#if character.totalLevel}(level {character.totalLevel}){/if}
					</option>
				{/each}
			</select>
		</label>
		<p class="text-sm text-base-content/70">
			Opens that character&apos;s new log form with this draft filled in. Nothing is saved until you save the log.
		</p>
		<button type="submit" class="btn w-fit btn-primary btn-sm" disabled={!targetPath}> Start new log with draft </button>
	</form>
{/if}
