<script lang="ts">
	import Meta from "$lib/components/Meta.svelte";
	import { newCharacterSchema } from "$lib/types/zod-schema.js";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const character = data.character;

	let saveForm: SchemaForm;
	let saving = false;
	let errors: Record<string, string> = {};
</script>

{#if data.characterId == "new"}
	<Meta title="New Character" />
{:else}
	<Meta title="Edit {character.name}" />
{/if}

<div class="breadcrumbs mb-4 text-sm">
	<ul>
		<li>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
				><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
			>
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

{#if form?.error}
	<div class="alert alert-error shadow-lg mb-4">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-6"
			><title>alert-circle</title><path
				fill="currentColor"
				d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"
			/></svg
		>
		{form.error}
	</div>
{/if}

<SchemaForm action="?/saveCharacter" data={character} bind:this={saveForm} bind:form bind:errors schema={newCharacterSchema}>
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
					on:input={() => saveForm.addChanges("name")}
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
					on:input={() => saveForm.addChanges("campaign")}
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
					on:input={() => saveForm.addChanges("race")}
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
					on:input={() => saveForm.addChanges("class")}
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
					on:input={() => saveForm.addChanges("character_sheet_url")}
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
					on:input={() => saveForm.addChanges("image_url")}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="image_url" class="label">
					<span class="label-text-alt text-error">{errors.image_url || ""}</span>
				</label>
			</div>
		</div>
		<div class="m-4 basis-full text-center">
			<button type="submit" class={twMerge("btn-primary btn", saving && "loading")} disabled={saving}>Save</button>
		</div>
	</div>
</SchemaForm>
