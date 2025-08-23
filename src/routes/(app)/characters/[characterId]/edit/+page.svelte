<script lang="ts">
	import { page } from "$app/state";
	import Breadcrumbs from "$lib/components/Breadcrumb.svelte";
	import Checkbox from "$lib/components/forms/Checkbox.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import Head from "$lib/components/Head.svelte";
	import { BLANK_CHARACTER } from "$lib/constants.js";
	import { errorToast, valibotForm } from "$lib/factories.svelte.js";
	import CharactersAPI from "$lib/remote/characters";
	import { editCharacterSchema } from "$lib/schemas";
	import { getGlobal, setBreadcrumb } from "$lib/stores.svelte.js";

	let { data } = $props();

	const global = getGlobal();
	const superform = valibotForm(data.form, editCharacterSchema, {
		remote: CharactersAPI.forms.save
	});

	const { form } = superform;

	setBreadcrumb({ url: `/characters/${data.character?.id}/edit`, title: data.character?.name ? "Edit" : "New Character" });
</script>

<Head title={data.character?.name || "New Character"} />

<Breadcrumbs />

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
	{#if data.character?.id === "new"}
		<Control class="col-span-12 -mb-4">
			<span class="fieldset-legend">
				<span>Options</span>
			</span>
		</Control>
	{/if}
	{#if data.character?.id === "new"}
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
