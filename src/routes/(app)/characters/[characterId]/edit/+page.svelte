<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm from "$lib/components/SchemaForm.svelte";
	import { newCharacterSchema } from "$src/lib/types/schemas";

	export let data;
	export let form;

	let character = data.character;

	export const snapshot = {
		capture: () => character,
		restore: (values) => (character = values)
	};
</script>

<BreadCrumbs />

<SchemaForm action="?/saveCharacter" schema={newCharacterSchema} data={character} let:errors let:saving>
	{#if form?.error || errors.has("form")}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form?.error || errors.get("form")}
		</div>
	{/if}

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
					bind:value={character.name}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if errors.has("name")}
					<label for="name" class="label">
						<span class="label-text-alt text-error">{errors.get("name")}</span>
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
					bind:value={character.campaign}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if errors.has("campaign")}
					<label for="campaign" class="label">
						<span class="label-text-alt text-error">{errors.get("campaign")}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="race" class="label">
					<span class="label-text">Species</span>
				</label>
				<input type="text" name="race" bind:value={character.race} class="input input-bordered w-full focus:border-primary" />
				{#if errors.has("race")}
					<label for="race" class="label">
						<span class="label-text-alt text-error">{errors.get("race")}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 sm:col-span-6">
			<div class="form-control w-full">
				<label for="class" class="label">
					<span class="label-text">Class</span>
				</label>
				<input type="text" name="class" bind:value={character.class} class="input input-bordered w-full focus:border-primary" />
				{#if errors.has("class")}
					<label for="class" class="label">
						<span class="label-text-alt text-error">{errors.get("class")}</span>
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
					bind:value={character.character_sheet_url}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if errors.has("character_sheet_url")}
					<label for="character_sheet_url" class="label">
						<span class="label-text-alt text-error">{errors.get("character_sheet_url")}</span>
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
					bind:value={character.image_url}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if errors.has("image_url")}
					<label for="image_url" class="label">
						<span class="label-text-alt text-error">{errors.get("image_url")}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 m-4 text-center">
			<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
				{#if saving}
					<span class="loading" />
				{/if}
				Save Character
			</button>
		</div>
	</div>
</SchemaForm>
