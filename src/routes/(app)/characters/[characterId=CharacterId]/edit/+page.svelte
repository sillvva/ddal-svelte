<script lang="ts" module>
	import type { RouteParams } from "./$types.js";
	export async function getPageTitle(params: RouteParams) {
		return params.characterId === "new" ? "New Character" : "Edit";
	}
	export async function getPageHead(params: RouteParams) {
		const character = await API.characters.queries.get({ param: params.characterId });
		return {
			title: params.characterId === "new" ? "New Character" : `Edit ${character.name}`
		};
	}
</script>

<script lang="ts">
	import { page } from "$app/state";
	import Checkbox from "$lib/components/forms/checkbox.svelte";
	import Control from "$lib/components/forms/control.svelte";
	import Input from "$lib/components/forms/input.svelte";
	import Submit from "$lib/components/forms/submit.svelte";
	import SuperForm from "$lib/components/forms/superform.svelte";
	import NavMenu from "$lib/components/nav-menu.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import { errorToast, valibotForm } from "$lib/factories.svelte.js";
	import * as API from "$lib/remote";
	import { editCharacterSchema } from "$lib/schemas";
	import { getGlobal } from "$lib/stores.svelte.js";

	let { params } = $props();

	const global = getGlobal();
	const editForm = await API.characters.forms.edit({ param: params.characterId, editing: true });
	const superform = valibotForm(editForm.form, editCharacterSchema, {
		remote: API.characters.forms.save
	});

	const { form } = superform;
</script>

<NavMenu />

<SuperForm {superform}>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="name" label="Character Name" />
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="campaign" label="Campaign" />
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="race" label="Species" />
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="class" label="Class" />
	</Control>
	<Control class="col-span-12">
		<Input type="url" {superform} field="characterSheetUrl" label="Character Sheet URL" />
	</Control>
	<Control class="col-span-12">
		<div class="flex items-center gap-4">
			<div class="flex-1">
				<Input
					type="url"
					{superform}
					field="imageUrl"
					label="Image URL"
					placeholder={`${page.url.origin}${BLANK_CHARACTER}`}
					description="Images from imgur may not appear when sharing links due to rate limiting"
				/>
			</div>
			<div class="mask mask-squircle bg-primary size-12">
				<img
					src={$form.imageUrl || BLANK_CHARACTER}
					width={48}
					height={48}
					class="size-full object-cover object-top duration-150 ease-in-out group-hover/row:scale-125 motion-safe:transition-transform"
					alt={$form.name}
					loading="lazy"
					onerror={(e) => {
						const img = e.currentTarget as HTMLImageElement;
						img.src = BLANK_CHARACTER;
						$form.imageUrl = "";
						errorToast("Image URL does not load. Reverting to default image.");
					}}
				/>
			</div>
		</div>
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
			<Checkbox
				{superform}
				field="firstLog"
				label="Create Starting Log"
				onchange={(ev) => {
					const checked = (ev.target as HTMLInputElement).checked;
					global.app.characters.firstLog = checked;
				}}
			/>
		</Control>
	{/if}
	<Submit {superform}>Save Character</Submit>
</SuperForm>
