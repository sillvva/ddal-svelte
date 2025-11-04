<script lang="ts">
	import { page } from "$app/state";
	import Error from "$lib/components/error.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import RemoteForm from "$lib/components/forms/remote-form.svelte";
	import RemoteInput from "$lib/components/forms/remote-input.svelte";
	import RemoteSubmit from "$lib/components/forms/remote-submit.svelte";
	import Head from "$lib/components/head.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import * as API from "$lib/remote";
	import { editCharacterSchema } from "$lib/schemas.js";
	import { getGlobal } from "$lib/stores.svelte.js";

	let { params } = $props();

	const global = getGlobal();

	const schema = editCharacterSchema;
	let form = API.characters.forms.save;
	const { character, initialErrors } = await API.characters.forms.get(params.characterId);
	const data = $state(character);
</script>

<Head title={params.characterId === "new" ? "New Character" : `Edit ${character.name}`} />

<NavMenu
	crumbs={[
		{ title: "Characters", url: "/characters" },
		// excluded for new character, due to empty name
		{ title: character.name, url: `/characters/${character.id}` },
		{ title: params.characterId === "new" ? "New Character" : "Edit", url: `/characters/${character.id}/edit` }
	]}
/>

<svelte:boundary>
	{#snippet failed(error)}<Error {error} />{/snippet}
	<RemoteForm {schema} {form} {data} {initialErrors}>
		{#snippet children({ fields })}
			<RemoteInput field={fields.id} type="hidden" />
			<Control class="col-span-12 sm:col-span-6">
				<RemoteInput field={fields.name} type="text" label="Character Name" required />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<RemoteInput field={fields.campaign} type="text" label="Campaign" />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<RemoteInput field={fields.race} type="text" label="Species" />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<RemoteInput field={fields.class} type="text" label="Class" />
			</Control>
			<Control class="col-span-12">
				<RemoteInput field={fields.characterSheetUrl} type="url" label="Character Sheet URL" />
			</Control>
			<Control class="col-span-12">
				<RemoteInput
					field={fields.imageUrl}
					type="url"
					label="Image URL"
					placeholder={`${page.url.origin}${BLANK_CHARACTER}`}
					warning={data.imageUrl?.includes("imgur")
						? "Images from imgur may not appear when sharing links due to rate limiting"
						: undefined}
				/>
			</Control>
			{#if params.characterId === "new"}
				<Control class="col-span-12 -mb-4">
					<span class="fieldset-legend">
						<span>Options</span>
					</span>
				</Control>
			{/if}
			{#if params.characterId === "new"}
				<Control class="col-span-12 sm:col-span-6">
					<RemoteInput
						field={fields.firstLog}
						type="checkbox"
						label="Create Starting Log"
						onchange={() => {
							global.setApp((app) => {
								app.characters.firstLog = data.firstLog;
							});
						}}
					/>
				</Control>
			{/if}
			<div class="col-span-12 my-4 flex justify-center">
				<RemoteSubmit>Save Character</RemoteSubmit>
			</div>
		{/snippet}
	</RemoteForm>
</svelte:boundary>
