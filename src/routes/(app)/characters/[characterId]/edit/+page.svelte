<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/Control.svelte";
	import Input from "$lib/components/Input.svelte";
	import Submit from "$lib/components/Submit.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { newCharacterSchema, valibotForm } from "$lib/schemas";

	export let data;

	$: superform = valibotForm(data.form, newCharacterSchema);
</script>

<BreadCrumbs />

<SuperForm action="?/saveCharacter" {superform} showMessage>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="name">Character Name</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="campaign">Campaign</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="race">Species</Input>
	</Control>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="class">Class</Input>
	</Control>
	<Control class="col-span-12">
		<Input type="text" {superform} field="character_sheet_url">Character Sheet URL</Input>
	</Control>
	<Control class="col-span-12">
		<Input type="text" {superform} field="image_url" placeholder={data.BLANK_CHARACTER}>Image URL</Input>
	</Control>
	<Submit {superform}>Save Character</Submit>
</SuperForm>
