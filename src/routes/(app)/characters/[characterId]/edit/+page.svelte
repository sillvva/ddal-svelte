<script lang="ts">
	import BackButton from "$lib/components/BackButton.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm, { emptyClone } from "$lib/components/SchemaForm.svelte";
	import { newCharacterSchema } from "$src/lib/types/schemas";

	export let data;
	export let form;

	let character = data.character;

	let saving = false;
	let errors = emptyClone(character);

	export const snapshot = {
		capture: () => character,
		restore: (values) => (character = values)
	};
</script>

<BreadCrumbs />

<BackButton href="/characters{data.characterId == 'new' ? '' : `/${data.characterId}`}">
	{data.characterId == "new" ? "Characters" : character.name}
</BackButton>

{#if form?.error}
	<div class="alert alert-error mb-4 shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		{form.error}
	</div>
{/if}

<SchemaForm action="?/saveCharacter" schema={newCharacterSchema} data={character} bind:errors bind:saving>
	<div class="grid grid-cols-12 gap-4">
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="name" class="label">
					<span class="label-text">
						Character Name
						<span class="text-error">*</span>
					</span>
				</label>
				<input
					type="text"
					name="name"
					required
					disabled={saving}
					bind:value={character.name}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.name}
					<label for="name" class="label">
						<span class="label-text-alt text-error">{errors.name}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="campaign" class="label">
					<span class="label-text">Campaign</span>
				</label>
				<input
					type="text"
					name="campaign"
					required
					disabled={saving}
					bind:value={character.campaign}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.campaign}
					<label for="campaign" class="label">
						<span class="label-text-alt text-error">{errors.campaign}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="race" class="label">
					<span class="label-text">Species</span>
				</label>
				<input
					type="text"
					name="race"
					disabled={saving}
					bind:value={character.race}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.race}
					<label for="race" class="label">
						<span class="label-text-alt text-error">{errors.race}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="class" class="label">
					<span class="label-text">Class</span>
				</label>
				<input
					type="text"
					name="class"
					disabled={saving}
					bind:value={character.class}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.class}
					<label for="class" class="label">
						<span class="label-text-alt text-error">{errors.class}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12">
			<div class="form-control w-full">
				<label for="character_sheet_url" class="label">
					<span class="label-text">Character Sheet URL</span>
				</label>
				<input
					type="text"
					name="character_sheet_url"
					disabled={saving}
					bind:value={character.character_sheet_url}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.character_sheet_url}
					<label for="character_sheet_url" class="label">
						<span class="label-text-alt text-error">{errors.character_sheet_url}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12">
			<div class="form-control w-full">
				<label for="image_url" class="label">
					<span class="label-text">Image URL</span>
				</label>
				<input
					type="text"
					name="image_url"
					disabled={saving}
					bind:value={character.image_url}
					class="input-bordered input w-full focus:border-primary"
				/>
				{#if errors.image_url}
					<label for="image_url" class="label">
						<span class="label-text-alt text-error">{errors.image_url}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="m-4 col-span-12 text-center">
			<button
				type="submit"
				class="btn-primary btn disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50"
				disabled={saving}
			>
				{#if saving}
					<span class="loading" />
				{/if}
				Save Character
			</button>
		</div>
	</div>
</SchemaForm>
