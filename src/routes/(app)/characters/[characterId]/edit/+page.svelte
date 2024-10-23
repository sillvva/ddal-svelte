<script lang="ts">
	import type { page } from "$app/stores";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Control from "$lib/components/forms/Control.svelte";
	import Input from "$lib/components/forms/Input.svelte";
	import Submit from "$lib/components/forms/Submit.svelte";
	import SuperForm from "$lib/components/forms/SuperForm.svelte";
	import { valibotForm } from "$lib/factories.js";
	import { newCharacterSchema, type NewCharacterSchema } from "$lib/schemas";
	import type { SuperValidated } from "sveltekit-superforms";

	interface Props {
		data: typeof $page.data & {
			form: SuperValidated<NewCharacterSchema>;
		};
	}

	let { data }: Props = $props();

	const superform = $derived(valibotForm(data.form, newCharacterSchema));
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
		<Input type="url" {superform} field="characterSheetUrl">Character Sheet URL</Input>
	</Control>
	<Control class="col-span-12">
		<Input type="url" {superform} field="imageUrl" placeholder={data.BLANK_CHARACTER}>Image URL</Input>
	</Control>
	<Submit {superform}>Save Character</Submit>
</SuperForm>
