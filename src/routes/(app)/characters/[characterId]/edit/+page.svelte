<script lang="ts">
	import { goto } from "$app/navigation";
	import Meta from "$lib/components/Meta.svelte";
	import { newCharacterSchema } from "$lib/types/zod-schema.js";
	import Icon from "$src/lib/components/Icon.svelte";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";

	export let data;
	export let form;

	const character = data.character;

	let saving = false;
	let errors: Record<string, string> = {};
	$: if (form?.id && saving) {
		goto(`/characters/${data.characterId}`);
	}
</script>

{#if data.characterId == "new"}
	<Meta title="New Character" />
{:else}
	<Meta title="Edit {character.name}" />
{/if}

<div class="breadcrumbs mb-4 hidden text-sm sm:flex">
	<ul>
		<li>
			<Icon src="home" class="w-4" />
		</li>
		<li>
			<a href="/characters" class="text-secondary">Characters</a>
		</li>
		{#if data.characterId == "new"}
			<li class="dark:drop-shadow-md">New Character</li>
		{:else}
			<li>
				<a href={`/characters/${data.characterId}`} class="text-secondary">
					{character.name}
				</a>
			</li>
			<li class="dark:drop-shadow-md">Edit</li>
		{/if}
	</ul>
</div>

<a href="/characters{data.characterId == 'new' ? '' : `/${data.characterId}`}" class="mb-4 flex gap-4 text-secondary sm:hidden">
	<Icon src="chevron-left" class="w-6" />
	<span>Back to {data.characterId == "new" ? "Characters" : character.name}</span>
</a>

{#if form?.error}
	<div class="alert alert-error mb-4 shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		{form.error}
	</div>
{/if}

<SchemaForm action="?/saveCharacter" data={character} bind:form bind:errors bind:saving schema={newCharacterSchema}>
	<div class="flex flex-wrap">
		<div class="basis-full px-2 sm:basis-1/2">
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
				<label for="name" class="label">
					<span class="label-text-alt text-error">{errors.name || ""}</span>
				</label>
			</div>
		</div>
		<div class="basis-full px-2 sm:basis-1/2">
			<div class="form-control w-full">
				<label for="campaign" class="label">
					<span class="label-text">
						Campaign
						<span class="text-error">*</span>
					</span>
				</label>
				<input
					type="text"
					name="campaign"
					required
					disabled={saving}
					bind:value={character.campaign}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="campaign" class="label">
					<span class="label-text-alt text-error">{errors.campaign || ""}</span>
				</label>
			</div>
		</div>
		<div class="basis-full px-2 sm:basis-1/2">
			<div class="form-control w-full">
				<label for="race" class="label">
					<span class="label-text">Race</span>
				</label>
				<input
					type="text"
					name="race"
					disabled={saving}
					bind:value={character.race}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="race" class="label">
					<span class="label-text-alt text-error">{errors.race || ""}</span>
				</label>
			</div>
		</div>
		<div class="basis-full px-2 sm:basis-1/2">
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
				<label for="class" class="label">
					<span class="label-text-alt text-error">{errors.class || ""}</span>
				</label>
			</div>
		</div>
		<div class="basis-full px-2">
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
				<label for="character_sheet_url" class="label">
					<span class="label-text-alt text-error">{errors.character_sheet_url || ""}</span>
				</label>
			</div>
		</div>
		<div class="basis-full px-2">
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
				<label for="image_url" class="label">
					<span class="label-text-alt text-error">{errors.image_url || ""}</span>
				</label>
			</div>
		</div>
		<div class="m-4 basis-full text-center">
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
