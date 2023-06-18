<script lang="ts">
	import { enhance } from "$app/forms";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let changes: string[] = [];
	let saving = false;

	function checkErrors(field: string) {
		return saving || changes.includes(field);
	}

	$: character = data.character;
	$: errors = {
		name: checkErrors("name") && character.name.length < 1 ? "Name is required" : "",
		campaign: checkErrors("campaign") && (character.campaign?.length || 0) < 1 ? "Campaign is required" : "",
		race: "",
		class: "",
		character_sheet_url: "",
		image_url: ""
	};

	$: {
		if (form && saving) saving = false;
	}
</script>

<div class="breadcrumbs mb-4 text-sm">
	<ul>
		<li>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4"
				><title>home</title><path fill="currentColor" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" /></svg
			>
		</li>
		<li>
			<a href="/characters" class="text-secondary"> Characters </a>
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
	<div class="alert alert-error mb-4">
		{form.error}
	</div>
{/if}

<form
	method="POST"
	action="?/saveCharacter"
	use:enhance={() => {
		form = null;
		saving = true;
		if (Object.values(errors).find((e) => e.length > 0)) {
			saving = false;
			return;
		}
		return async ({ update }) => {
			await update({ reset: false });
			saving = false;
		};
	}}
>
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
					value={character.name}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="name" class="label">
					<span class="label-text-alt text-error">{errors.name}</span>
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
					value={character.campaign || ""}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="campaign" class="label">
					<span class="label-text-alt text-error">{errors.campaign}</span>
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
					value={character.race}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="race" class="label">
					<span class="label-text-alt text-error">{errors.race}</span>
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
					value={character.class}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="class" class="label">
					<span class="label-text-alt text-error">{errors.class}</span>
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
					value={character.character_sheet_url}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="character_sheet_url" class="label">
					<span class="label-text-alt text-error">{errors.character_sheet_url}</span>
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
					value={character.image_url}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="image_url" class="label">
					<span class="label-text-alt text-error">{errors.image_url}</span>
				</label>
			</div>
		</div>
		<div class="m-4 basis-full text-center">
			<button type="submit" class={twMerge("btn-primary btn", saving && "loading")} disabled={saving}>Save</button>
		</div>
	</div>
</form>
