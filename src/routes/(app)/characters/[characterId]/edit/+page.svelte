<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { newCharacterSchema } from "$lib/schemas";
	import Icon from "$src/lib/components/Icon.svelte";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";

	export let data;

	const characterForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(newCharacterSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message } = characterForm;
</script>

<BreadCrumbs />

<SuperForm action="?/saveCharacter" superForm={characterForm}>
	{#if $message}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{$message}
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
					id="name"
					required
					bind:value={$form.name}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.name}
					<label for="name" class="label">
						<span class="label-text-alt text-error">{$errors.name}</span>
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
					id="campaign"
					bind:value={$form.campaign}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.campaign}
					<label for="campaign" class="label">
						<span class="label-text-alt text-error">{$errors.campaign}</span>
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
					id="race"
					bind:value={$form.race}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.race}
					<label for="race" class="label">
						<span class="label-text-alt text-error">{$errors.race}</span>
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
					id="class"
					bind:value={$form.class}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.class}
					<label for="class" class="label">
						<span class="label-text-alt text-error">{$errors.class}</span>
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
					id="character_sheet_url"
					bind:value={$form.character_sheet_url}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.character_sheet_url}
					<label for="character_sheet_url" class="label">
						<span class="label-text-alt text-error">{$errors.character_sheet_url}</span>
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
					id="image_url"
					bind:value={$form.image_url}
					class="input input-bordered w-full focus:border-primary"
				/>
				{#if $errors.image_url}
					<label for="image_url" class="label">
						<span class="label-text-alt text-error">{$errors.image_url}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="col-span-12 m-4 text-center">
			<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
				{#if $submitting}
					<span class="loading" />
				{/if}
				Save Character
			</button>
		</div>
	</div>
</SuperForm>
