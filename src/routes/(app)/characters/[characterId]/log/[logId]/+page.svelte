<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import FormMessage from "$lib/components/FormMessage.svelte";
	import HComboBox from "$lib/components/HComboBox.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { defaultDM } from "$lib/entities";
	import { logSchema } from "$lib/schemas";
	import DateInput from "$src/lib/components/DateInput.svelte";
	import EntityCard from "$src/lib/components/EntityCard.svelte";
	import GenericInput from "$src/lib/components/GenericInput.svelte";
	import Input from "$src/lib/components/Input.svelte";
	import MdTextInput from "$src/lib/components/MDTextInput.svelte";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { twMerge } from "tailwind-merge";

	export let data;

	let superform = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(logSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message } = superform;

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;
	let DCI = $form.dm.DCI || "";
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" {superform}>
	<FormMessage {message} />
	<div class="grid grid-cols-12 gap-4">
		<div class="form-control col-span-12 sm:col-span-4">
			<GenericInput {superform} field="type" label="Log Type">
				<select
					id="type"
					bind:value={$form.type}
					class="select select-bordered w-full"
					aria-invalid={$errors.type ? "true" : undefined}
				>
					<option value="game">Game</option>
					<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
				</select>
			</GenericInput>
		</div>
		<div class="form-control col-span-12 sm:col-span-4">
			<Input type="text" {superform} field="name" required>Title</Input>
		</div>
		<div class="form-control col-span-12 sm:col-span-4">
			<DateInput {superform} field="date" required>Date</DateInput>
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#if $form.type === "game"}
				<div class="form-control col-span-6">
					<GenericInput {superform} field="dm.name" label="DM Name" required={!!$form.dm.DCI}>
						<HComboBox
							id="dm.name"
							bind:value={$form.dm.id}
							bind:inputValue={$form.dm.name}
							values={data.dms.map((dm) => ({
								value: dm.id,
								label: dm.name,
								itemLabel: dm.name + (dm.uid === data.user.id ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
							})) || []}
							allowCustom
							required={!!$form.dm.DCI}
							on:select={(e) => {
								console.log(e.detail?.selected?.value);
								$form.dm =
									data.dms.find((dm) => dm.id === e.detail?.selected?.value) ||
									(e.detail?.input || $form.dm.DCI
										? {
												...$form.dm,
												name: e.detail?.input || "",
												owner: data.user.id
											}
										: defaultDM(data.user.id));
								DCI = $form.dm.DCI || "";
							}}
							clearable
							on:clear={() => ($form.dm = defaultDM(data.user.id))}
							errors={$errors.dm?.name}
						/>
					</GenericInput>
				</div>
				<div class="form-control col-span-6">
					<GenericInput {superform} field="dm.DCI" label="DM DCI">
						<HComboBox
							id="dm.DCI"
							bind:value={$form.dm.id}
							bind:inputValue={DCI}
							values={data.dms
								.filter((dm) => dm.DCI)
								.map((dm) => ({
									value: dm.id,
									label: dm.DCI || "",
									itemLabel: `${dm.DCI} (${dm.name}${dm.uid === data.user.id ? `, Me` : ""})`
								})) || []}
							allowCustom
							on:input={() => ($form.dm.DCI = DCI || null)}
							on:select={(e) => {
								$form.dm =
									data.dms.find((dm) => dm.id === e.detail?.selected?.value) ||
									($form.dm.name || e.detail?.input
										? {
												...$form.dm,
												DCI: e.detail?.input || null,
												owner: data.user.id
											}
										: defaultDM(data.user.id));
							}}
							clearable
							on:clear={() => ($form.dm = defaultDM(data.user.id))}
							errors={$errors.dm?.DCI}
						/>
					</GenericInput>
				</div>
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
					<div class="form-control col-span-6 w-full sm:col-span-4">
						<Input type="number" {superform} field="experience" min="0">Experience</Input>
					</div>
				{/if}
				{#if season === 9}
					<div class="form-control col-span-12 w-full sm:col-span-4">
						<Input type="number" {superform} field="level" min="0" max={Math.max($form.level, 20 - data.totalLevel)}>Level</Input>
					</div>
				{/if}
			{/if}
			{#if season === 8 || $form.type === "nongame"}
				{#if $form.type === "game"}
					<div class="form-control col-span-6 w-full sm:col-span-2">
						<Input type="number" {superform} field="acp" min="0">ACP</Input>
					</div>
				{/if}
				<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
					<Input type="number" {superform} field="tcp" min="0">TCP</Input>
				</div>
			{/if}
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
				<Input type="number" {superform} field="gold" min="0">Gold</Input>
			</div>
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
				<Input type="number" {superform} field="dtd" min="0">Downtime</Input>
			</div>
		</div>
		<div class="form-control col-span-12 w-full">
			<MdTextInput {superform} field="description" maxRows={20} preview>Notes</MdTextInput>
		</div>
		<div class="no-script-hide col-span-12 flex flex-wrap gap-4">
			<button
				type="button"
				class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
				on:click={() => ($form.magic_items_gained = [...$form.magic_items_gained, { id: "", name: "", description: "" }])}
			>
				Add Magic Item
			</button>
			{#if data.magicItems.filter((item) => !$form.magic_items_lost.includes(item.id)).length > 0}
				<button
					type="button"
					class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() =>
						($form.magic_items_lost = [
							...$form.magic_items_lost,
							data.magicItems.filter((item) => !$form.magic_items_lost.includes(item.id))[0].id
						])}
				>
					Drop Magic Item
				</button>
			{/if}
			{#if $form.type === "game"}
				<button
					type="button"
					class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() => ($form.story_awards_gained = [...$form.story_awards_gained, { id: "", name: "", description: "" }])}
				>
					Add Story Award
				</button>
				{#if data.storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id)).length > 0}
					<button
						type="button"
						class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
						on:click={() =>
							($form.story_awards_lost = [
								...$form.story_awards_lost,
								data.storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id))[0].id || ""
							])}
					>
						Drop Story Award
					</button>
				{/if}
			{/if}
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4 dark:text-white">
			{#each $form.magic_items_gained as _, index}
				<EntityCard
					{superform}
					type="add"
					entity="magic_items"
					nameField={`magic_items_gained[${index}].name`}
					descField={`magic_items_gained[${index}].description`}
					on:delete={() => ($form.magic_items_gained = $form.magic_items_gained.filter((_, i) => i !== index))}
				/>
			{/each}
			{#each $form.magic_items_lost as _, index}
				<EntityCard
					{superform}
					type="drop"
					entity="magic_items"
					lostField={`magic_items_lost[${index}]`}
					data={data.magicItems}
					arrValue={$form.magic_items_lost}
					on:delete={() => ($form.magic_items_lost = $form.magic_items_lost.filter((_, i) => i !== index))}
				/>
			{/each}
			{#each $form.story_awards_gained as _, index}
				<EntityCard
					{superform}
					type="add"
					entity="story_awards"
					nameField={`story_awards_gained[${index}].name`}
					descField={`story_awards_gained[${index}].description`}
					on:delete={() => ($form.story_awards_gained = $form.story_awards_gained.filter((_, i) => i !== index))}
				/>
			{/each}
			{#each $form.story_awards_lost as _, index}
				<EntityCard
					{superform}
					type="drop"
					entity="story_awards"
					lostField={`story_awards_lost[${index}]`}
					data={data.storyAwards}
					arrValue={$form.story_awards_lost}
					on:delete={() => ($form.story_awards_lost = $form.story_awards_lost.filter((_, i) => i !== index))}
				/>
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
</SuperForm>
