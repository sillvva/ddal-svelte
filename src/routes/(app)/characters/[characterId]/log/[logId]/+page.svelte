<script lang="ts">
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import FormMessage from "$lib/components/FormMessage.svelte";
	import HComboBox from "$lib/components/HComboBox.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { defaultDM, getMagicItems, getStoryAwards } from "$lib/entities";
	import { characterLogSchema } from "$lib/schemas";
	import { sorter } from "$lib/util";
	import DateInput from "$src/lib/components/DateInput.svelte";
	import GenericInput from "$src/lib/components/GenericInput.svelte";
	import MdTextInput from "$src/lib/components/MDTextInput.svelte";
	import NumberInput from "$src/lib/components/NumberInput.svelte";
	import TextInput from "$src/lib/components/TextInput.svelte";
	import { dateProxy, superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { twMerge } from "tailwind-merge";

	export let data;

	const character = data.character;

	let logForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(characterLogSchema(character)),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message, constraints } = logForm;

	const proxyDate = dateProxy(form, "date", { format: "datetime-local" });

	let magicItems = character
		? getMagicItems(character, { excludeDropped: true, lastLogId: $form.id }).sort((a, b) => sorter(a.name, b.name))
		: [];
	let storyAwards = character
		? getStoryAwards(character, { excludeDropped: true, lastLogId: $form.id }).sort((a, b) => sorter(a.name, b.name))
		: [];

	let previews = {
		description: false
	};

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;
	let dmSelected = false;
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" superForm={logForm}>
	<FormMessage {message} />
	<div class="grid grid-cols-12 gap-4">
		<div class="form-control col-span-12 sm:col-span-4">
			<GenericInput superform={logForm} field="type" label="Log Type">
				<select
					name="type"
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
			<TextInput superform={logForm} field="name" required>Title</TextInput>
		</div>
		<div class="form-control col-span-12 sm:col-span-4">
			<DateInput superform={logForm} field="date" bind:proxy={$proxyDate} required>Date</DateInput>
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#if $form.type === "game"}
				<div class="form-control col-span-6">
					<GenericInput superform={logForm} field="dm.name" label="DM Name" required={!!$form.dm.DCI}>
						<HComboBox
							name="dmName"
							bind:value={$form.dm.name}
							values={data.dms.map((dm) => ({
								key: dm.id,
								value: dm.name,
								label: dm.name + (dm.uid === data.user.id ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
							})) || []}
							allowCustom
							required={!!$form.dm.DCI}
							bind:selected={dmSelected}
							on:select={(e) => {
								const dm = data.dms.find((dm) => dm.id === e.detail?.key) || {
									id: "",
									name: $form.dm.name,
									DCI: $form.dm.DCI || null,
									uid: "",
									owner: data.user.id
								};
								const { id, name, DCI, uid, owner } = dm;
								$form.dm = { id, name, DCI, uid, owner };
							}}
							clearable
							on:clear={() => ($form.dm = defaultDM(data.user.id))}
							aria-invalid={$errors.dm?.name ? "true" : undefined}
						/>
					</GenericInput>
				</div>
				<div class="form-control col-span-6">
					<GenericInput superform={logForm} field="dm.DCI" label="DM DCI">
						<HComboBox
							name="dmDCI"
							bind:value={$form.dm.DCI}
							values={data.dms
								.filter((dm) => dm.DCI)
								.map((dm) => ({
									key: dm.id,
									value: `${dm.DCI}`,
									label: `${dm.DCI} (${dm.name}${dm.uid === data.user.id ? `, Me` : ""})`
								})) || []}
							allowCustom
							bind:selected={dmSelected}
							on:select={(e) => {
								const dm = data.dms.find((dm) => dm.id === e.detail?.key) || {
									id: "",
									name: $form.dm.name,
									DCI: $form.dm.DCI || null,
									uid: "",
									owner: data.user.id
								};
								const { id, name, DCI, uid, owner } = dm;
								$form.dm = { id, name, DCI, uid, owner };
							}}
							clearable
							on:clear={() => ($form.dm = defaultDM(data.user.id))}
							aria-invalid={$errors.dm?.DCI ? "true" : undefined}
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
						<NumberInput superform={logForm} field="experience" min="0">Experience</NumberInput>
					</div>
				{/if}
				{#if season === 9}
					<div class="form-control col-span-12 w-full sm:col-span-4">
						<NumberInput
							superform={logForm}
							field="level"
							min="0"
							max={Math.max($form.level, character ? 20 - character.total_level : 19)}>Level</NumberInput
						>
					</div>
				{/if}
			{/if}
			{#if season === 8 || $form.type === "nongame"}
				{#if $form.type === "game"}
					<div class="form-control col-span-6 w-full sm:col-span-2">
						<NumberInput superform={logForm} field="acp" min="0">ACP</NumberInput>
					</div>
				{/if}
				<div class={twMerge("form-control w-full", $form.type === "nongame" ? "col-span-4" : "col-span-6 sm:col-span-2")}>
					<NumberInput superform={logForm} field="tcp" min="0">TCP</NumberInput>
				</div>
			{/if}
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
				<NumberInput superform={logForm} field="gold" min="0">Gold</NumberInput>
			</div>
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
				<NumberInput superform={logForm} field="dtd" min="0">Downtime</NumberInput>
			</div>
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
			{#if magicItems.filter((item) => !$form.magic_items_lost.includes(item.id)).length > 0}
				<button
					type="button"
					class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() =>
						($form.magic_items_lost = [
							...$form.magic_items_lost,
							magicItems.filter((item) => !$form.magic_items_lost.includes(item.id))[0].id
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
				{#if storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id)).length > 0}
					<button
						type="button"
						class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
						on:click={() =>
							($form.story_awards_lost = [
								...$form.story_awards_lost,
								storyAwards.filter((item) => !$form.story_awards_lost.includes(item.id))[0].id || ""
							])}
					>
						Drop Story Award
					</button>
				{/if}
			{/if}
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
							<MdTextInput superform={logForm} field={`magic_items_gained[${index}].description`} maxRows={8} preview>
								Description
							</MdTextInput>
						</div>
					</div>
				</div>
			{/each}
			{#each $form.magic_items_lost as id, index}
				<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Drop Magic Item</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<GenericInput superform={logForm} field={`magic_items_lost[${index}]`} label="Select an Item">
									<select
										value={$form.magic_items_lost[index]}
										on:input={(e) => {
											$form.magic_items_lost[index] = e.currentTarget.value;
										}}
										name={`magic_items_lost.${index}`}
										class="select select-bordered w-full"
										aria-invalid={$errors.magic_items_lost?.[index] ? "true" : undefined}
									>
										{#each magicItems.filter((item) => item.id === id || !$form.magic_items_lost.includes(item.id)) as item}
											<option value={item.id}>
												{item.name}
											</option>
										{/each}
									</select>
								</GenericInput>
							</div>
							<button
								type="button"
								class="no-script-hide btn btn-error mt-9"
								on:click={() => ($form.magic_items_lost = $form.magic_items_lost.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{magicItems.find((item) => $form.magic_items_lost[index] === item.id)?.description || ""}</div>
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
							<MdTextInput superform={logForm} field={`story_awards_gained[${index}].description`} maxRows={8}>
								Description
							</MdTextInput>
						</div>
					</div>
				</div>
			{/each}
			{#each $form.story_awards_lost as id, index}
				<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Drop Story Award</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<GenericInput superform={logForm} field={`story_awards_lost[${index}]`} label="Select an Item">
									<select
										value={$form.story_awards_lost[index]}
										on:input={(e) => {
											$form.story_awards_lost[index] = e.currentTarget.value;
										}}
										name={`story_awards_lost.${index}`}
										class="select select-bordered w-full"
										aria-invalid={$errors.story_awards_lost?.[index] ? "true" : undefined}
									>
										{#each storyAwards.filter((item) => item.id === id || !$form.story_awards_lost.includes(item.id)) as item}
											<option value={item.id}>
												{item.name}
											</option>
										{/each}
									</select>
								</GenericInput>
							</div>
							<button
								type="button"
								class="no-script-hide btn btn-error mt-9"
								on:click={() => ($form.story_awards_lost = $form.story_awards_lost.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{storyAwards.find((item) => $form.story_awards_lost[index] === item.id)?.description || ""}</div>
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
</SuperForm>
