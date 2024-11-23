<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories.svelte.js";
	import { newCharacterSchema } from "$lib/schemas";

	let { data } = $props();

	const superform = $derived(valibotForm(data.form, newCharacterSchema));
</script>

<BreadCrumbs />

<SuperForm action="?/saveCharacter" {superform} showMessage>
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
		<Input type="url" {superform} field="imageUrl" label="Image URL" placeholder={data.BLANK_CHARACTER} />
	</Control>
	<Submit {superform}>Save Character</Submit>
</SuperForm>
