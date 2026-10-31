<script lang="ts">
	import Error from "#lib/components/error.svelte";
	import Combobox from "#lib/components/forms/combobox.svelte";
	import ImageUpload from "#lib/components/forms/image-upload.svelte";
	import Control from "#lib/components/forms/control.svelte";
	import Input from "#lib/components/forms/input.svelte";
	import RemoteForm from "#lib/components/forms/remote-form.svelte";
	import Submit from "#lib/components/forms/submit.svelte";
	import Head from "#lib/components/head.svelte";
	import NavMenu from "#lib/components/nav-menu.svelte";
	import { proxify } from "#lib/factories.svelte.js";
	import * as API from "#lib/remote/index.js";
	import { editCharacterSchema } from "#lib/schemas.js";
	import { getGlobal } from "#lib/stores.svelte.js";
	import { page } from "$app/state";

	let { params } = $props();

	const global = getGlobal();

	const schema = editCharacterSchema;
	const form = API.characters.forms.save;
	const draft = $derived(page.url.searchParams.get("draft") ?? "");
	const character = $derived(await API.characters.forms.get({ param: params.characterId, draft }));
	const initialErrors = $derived(params.characterId !== "new");

	let data = $derived(proxify(character));
	let imageUploadPending = $state(false);
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
	{#snippet failed(error)}<Error {error} boundary="edit-character" />{/snippet}
	<RemoteForm {schema} {form} {data} {initialErrors}>
		{#snippet children(ctx)}
			{const { form } = $derived(ctx)}
			<Input field={form.fields.id} type="hidden" />
			<Control class="col-span-12 sm:col-span-6">
				<Input field={form.fields.name} label="Character Name" required />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<Combobox
					inputField={form.fields.campaign}
					label="Campaign"
					allowCustom
					clearable
					required
					values={[
						{ value: "Forgotten Realms" },
						{ value: "Eberron" },
						{ value: "Dragonlance" },
						{ value: "Ravenloft" },
						{ value: "Critical Role" }
					]}
				/>
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<Input field={form.fields.race} label="Species" required />
			</Control>
			<Control class="col-span-12 sm:col-span-6">
				<Input field={form.fields.class} label="Class" required />
			</Control>
			<Control class="col-span-12">
				<Input field={form.fields.characterSheetUrl} type="url" label="Character Sheet URL" />
			</Control>
			<Control class="col-span-12">
				{#key data.id}
					<ImageUpload
						purpose="character"
						field={form.fields.imageUrl}
						characterId={data.id}
						savedUrl={data.imageUrl}
						onpending={(pending) => {
							imageUploadPending = pending;
						}}
					/>
				{/key}
			</Control>
			{#if params.characterId === "new"}
				<Control class="col-span-12">
					<span class="fieldset-legend">
						<span>Options</span>
					</span>
				</Control>
			{/if}
			{#if params.characterId === "new"}
				<Control class="col-span-12 sm:col-span-6">
					<Input
						field={form.fields.firstLog}
						type="checkbox"
						label="Create Starting Log"
						onchange={() => {
							global.app.characters.firstLog = data.firstLog;
						}}
					/>
				</Control>
			{/if}
			<div class="col-span-12 mt-8 mb-4 flex justify-center">
				<Submit form={ctx} disabled={imageUploadPending}>Save Character</Submit>
			</div>
		{/snippet}
	</RemoteForm>
</svelte:boundary>
