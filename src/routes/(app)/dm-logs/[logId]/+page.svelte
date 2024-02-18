<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import FormMessage from "$lib/components/FormMessage.svelte";
	import HComboBox from "$lib/components/HComboBox.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { dMLogSchema } from "$lib/schemas";
	import DateInput from "$src/lib/components/DateInput.svelte";
	import GenericInput from "$src/lib/components/GenericInput.svelte";
	import MdTextInput from "$src/lib/components/MDTextInput.svelte";
	import NumberInput from "$src/lib/components/NumberInput.svelte";
	import TextInput from "$src/lib/components/TextInput.svelte";
	import { dateProxy, superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { twMerge } from "tailwind-merge";

	export let data;

	let previews = {
		description: false
	};

	let logForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(dMLogSchema(data.characters)),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message, constraints } = logForm;

	const proxyDate = dateProxy(form, "date", { format: "datetime-local" });
	const proxyAppliedDate = dateProxy(form, "applied_date", { format: "datetime-local", empty: "null" });

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" superForm={logForm}>
	<FormMessage {message} />
	<div class="grid grid-cols-12 gap-4">
		<div class={twMerge("form-control col-span-12 sm:col-span-6 lg:col-span-3")}>
			<TextInput superform={logForm} field="name" required>Title</TextInput>
		</div>
		<div class={twMerge("form-control col-span-12 sm:col-span-6 lg:col-span-3")}>
			<DateInput superform={logForm} field="date" bind:proxy={$proxyDate} required>Date</DateInput>
		</div>
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<GenericInput
				superform={logForm}
				field="characterId"
				labelFor="characterName"
				required={!!$form.applied_date}
				label="Assigned Character"
			>
				<input type="hidden" name="characterId" bind:value={$form.characterId} />
				<HComboBox
					name="characterName"
					required={!!$form.applied_date}
					bind:value={$form.characterName}
					values={data.characters.map((char) => ({ key: char.id, value: char.name }))}
					on:input={() => {
						$form.characterId = "";
					}}
					on:select={(e) => {
						const character = data.characters.find((c) => c.id === e.detail?.key);
						if (character && character.name === $form.characterName) {
							$form.characterId = character.id;
							$form.applied_date = $form.applied_date || new Date();
						} else {
							$form.characterName = "";
							$form.characterId = "";
							if (data.logId === "new") $form.applied_date = null;
						}
					}}
					clearable
					on:clear={() => {
						$form.characterName = "";
						$form.characterId = "";
						$form.applied_date = null;
					}}
					aria-invalid={$errors.characterId ? "true" : undefined}
				/>
			</GenericInput>
		</div>
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<DateInput
				superform={logForm}
				field="applied_date"
				bind:proxy={$proxyAppliedDate}
				min={$proxyDate}
				required={!!$form.characterId}
			>
				Assigned Date
			</DateInput>
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			<div class="form-control col-span-12 sm:col-span-4">
				<GenericInput labelFor="season" label="Season">
					<select id="season" bind:value={season} class="select select-bordered w-full">
						<option value={9}>Season 9+</option>
						<option value={8}>Season 8</option>
						<option value={1}>Season 1-7</option>
					</select>
				</GenericInput>
			</div>
			{#if season === 1}
				<div class="form-control col-span-12 w-full sm:col-span-4">
					<NumberInput superform={logForm} field="experience" min="0">Experience</NumberInput>
				</div>
			{/if}
			{#if season === 9}
				<div class="form-control col-span-12 w-full sm:col-span-4">
					<NumberInput superform={logForm} field="level" min="0">Level</NumberInput>
				</div>
			{/if}
			{#if season === 8}
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<NumberInput superform={logForm} field="acp" min="0">ACP</NumberInput>
				</div>
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<NumberInput superform={logForm} field="tcp" min="0">TCP</NumberInput>
				</div>
			{/if}
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<NumberInput superform={logForm} field="gold" min="0">Gold</NumberInput>
			</div>
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<NumberInput superform={logForm} field="dtd" min="0">Downtime</NumberInput>
			</div>
			<div class="form-control col-span-12 w-full">
				<MdTextInput superform={logForm} field="description" maxRows={20} preview>Notes</MdTextInput>
			</div>
			<div class="no-script-hide col-span-12 flex flex-wrap gap-4">
				<button
					type="button"
					class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() => ($form.magic_items_gained = [...$form.magic_items_gained, { id: "", name: "", description: "" }])}
				>
					Add Magic Item
				</button>
				<button
					type="button"
					class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() => ($form.story_awards_gained = [...$form.story_awards_gained, { id: "", name: "", description: "" }])}
				>
					Add Story Award
				</button>
			</div>
			<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
				{#each $form.magic_items_gained as _, index}
					<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
						<div class="card-body flex flex-col gap-4">
							<h4 class="text-2xl">Add Magic Item</h4>
							<div class="flex gap-4">
								<div class="form-control flex-1">
									<TextInput superform={logForm} field={`magic_items_gained[${index}].name`} required>Name</TextInput>
								</div>
								<button
									type="button"
									class="no-script-hide btn btn-error mt-9"
									on:click={() => ($form.magic_items_gained = $form.magic_items_gained.filter((_, i) => i !== index))}
								>
									<Icon src="trash-can" class="w-6" />
								</button>
							</div>
							<div class="form-control w-full">
								<MdTextInput superform={logForm} field={`magic_items_gained[${index}].description`} minRows={3} maxRows={8}>
									Description
								</MdTextInput>
							</div>
						</div>
					</div>
				{/each}
				{#each $form.story_awards_gained as _, index}
					<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
						<div class="card-body flex flex-col gap-4">
							<h4 class="text-2xl">Add Story Award</h4>
							<div class="flex gap-4">
								<div class="form-control flex-1">
									<TextInput superform={logForm} field={`story_awards_gained[${index}].name`} required>Name</TextInput>
								</div>
								<button
									type="button"
									class="no-script-hide btn btn-error mt-9"
									on:click={() => ($form.story_awards_gained = $form.story_awards_gained.filter((_, i) => i !== index))}
								>
									<Icon src="trash-can" class="w-6" />
								</button>
							</div>
							<div class="form-control w-full">
								<MdTextInput superform={logForm} field={`story_awards_gained[${index}].description`} minRows={3} maxRows={8}>
									Description
								</MdTextInput>
							</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="col-span-12 text-center">
				<button type="submit" class="btn btn-primary disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50">
					{#if $submitting}
						<span class="loading" />
					{/if}
					Save Log
				</button>
			</div>
		</div>
	</div>
</SuperForm>
