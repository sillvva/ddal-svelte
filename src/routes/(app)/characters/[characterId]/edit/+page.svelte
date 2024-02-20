<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/Control.svelte";
	import Input from "$lib/components/Input.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { newCharacterSchema } from "$lib/schemas";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";

	export let data;

	const superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(newCharacterSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { submitting, message } = superform;
</script>

<BreadCrumbs />

<SuperForm action="?/saveCharacter" {superform} showMessage>
	<Control class="col-span-12 sm:col-span-6">
		<Input type="text" {superform} field="name" required>Character Name</Input>
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
	<div class="col-span-12 m-4 text-center">
		<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
			{#if $submitting}
				<span class="loading" />
			{/if}
			Save Character
		</button>
	</div>
</SuperForm>
