<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import FormMessage from "$lib/components/FormMessage.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { newCharacterSchema } from "$lib/schemas";
	import Input from "$src/lib/components/Input.svelte";
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

<SuperForm action="?/saveCharacter" {superform}>
	<FormMessage {message} />
	<div class="grid grid-cols-12 gap-4">
		<div class="form-control col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="name" required>Character Name</Input>
		</div>
		<div class="form-control col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="campaign">Campaign</Input>
		</div>
		<div class="form-control col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="race">Species</Input>
		</div>
		<div class="form-control col-span-12 sm:col-span-6">
			<Input type="text" {superform} field="class">Class</Input>
		</div>
		<div class="form-control col-span-12">
			<Input type="text" {superform} field="character_sheet_url">Character Sheet URL</Input>
		</div>
		<div class="form-control col-span-12">
			<Input type="text" {superform} field="image_url" placeholder={data.BLANK_CHARACTER}>Image URL</Input>
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
