<script lang="ts">
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import ComboBox from "$lib/components/ComboBox.svelte";
	import DateTimeInput from "$lib/components/DateTimeInput.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { logSchema } from "$lib/schemas";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { twMerge } from "tailwind-merge";

	export let data;

	let character = data.character;
	let previews = {
		description: false
	};

	let logForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(logSchema)
	});

	const { form, errors, submitting, message } = logForm;

	let season: 1 | 8 | 9 = $form.experience ? 1 : $form.acp ? 8 : 9;

	$: if (!character && $form.characterId && data.characters.find((c) => c.id === $form.characterId)) {
		character = data.characters.find((c) => c.id === $form.characterId);
	}
</script>

<BreadCrumbs />

<SuperForm action="?/saveLog" superForm={logForm}>
	{#if $message}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{$message}
		</div>
	{/if}

	<input type="hidden" name="id" value={$form.id} />
	<input type="hidden" name="dm.id" value={$form.dm.id} />
	<input type="hidden" name="dm.DCI" value={$form.dm.DCI} />
	<input type="hidden" name="dm.name" value={$form.dm.name} />
	<input type="hidden" name="dm.uid" value={$form.dm.uid} />
	<input type="hidden" name="dm.owner" value={$form.dm.owner} />
	<input type="hidden" name="is_dm_log" value="true" />
	<div class="grid grid-cols-12 gap-4">
		<div class={twMerge("form-control col-span-12 sm:col-span-6 lg:col-span-3")}>
			<label for="name" class="label">
				<span class="label-text">
					Title
					<span class="text-error">*</span>
				</span>
			</label>
			<input
				type="text"
				name="name"
				required
				bind:value={$form.name}
				class="input input-bordered w-full focus:border-primary"
				aria-invalid={$errors.name ? "true" : "false"}
			/>
			{#if $errors.name}
				<label for="name" class="label">
					<span class="label-text-alt text-error">{$errors.name}</span>
				</label>
			{/if}
		</div>
		<div class={twMerge("form-control col-span-12 sm:col-span-6 lg:col-span-3")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<DateTimeInput name="date" bind:date={$form.date} required class="input input-bordered w-full focus:border-primary" />
			{#if $errors.date}
				<label for="date" class="label">
					<span class="label-text-alt text-error">{$errors.date}</span>
				</label>
			{/if}
		</div>
		<input type="hidden" name="characterId" bind:value={$form.characterId} />
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<label for="characterName" class="label">
				<span class="label-text">
					Assigned Character
					{#if $form.applied_date}
						<span class="text-error">*</span>
					{/if}
				</span>
			</label>
			<ComboBox
				type="text"
				name="characterName"
				value={character?.name || ""}
				values={data.characters?.map((char) => ({ key: char.id, value: char.name })) || []}
				required={!!$form.applied_date}
				searchBy="value"
				on:input={() => {
					$form.characterId = "";
				}}
				on:select={(ev) => {
					character = data.characters.find((c) => c.id === ev.detail);
					$form.characterId = character ? ev.detail.toString() : "";
					if ($form.characterId) $form.applied_date = $form.applied_date || new Date();
				}}
			/>
			{#if $errors.characterId}
				<label for="characterName" class="label">
					<span class="label-text-alt text-error">{$errors.characterId}</span>
				</label>
			{/if}
		</div>
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<label for="applied_date" class="label">
				<span class="label-text">
					Assigned Date
					{#if $form.characterId}
						<span class="text-error">*</span>
					{/if}
				</span>
			</label>
			<DateTimeInput
				name="applied_date"
				bind:date={$form.applied_date}
				required={!!$form.characterId}
				class="input input-bordered w-full focus:border-primary"
				aria-invalid={$errors.applied_date ? "true" : "false"}
			/>
			{#if $errors.applied_date}
				<label for="applied_date" class="label">
					<span class="label-text-alt text-error">{$errors.applied_date}</span>
				</label>
			{/if}
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			<div class="form-control col-span-12 sm:col-span-4">
				<label for="season" class="label">
					<span class="label-text">Season</span>
				</label>
				<select bind:value={season} class="select select-bordered w-full">
					<option value={9}>Season 9+</option>
					<option value={8}>Season 8</option>
					<option value={1}>Season 1-7</option>
				</select>
			</div>
			{#if season === 1}
				<div class="form-control col-span-12 w-full sm:col-span-4">
					<label for="experience" class="label">
						<span class="label-text">Experience</span>
					</label>
					<input type="number" bind:value={$form.experience} min="0" class="input input-bordered w-full focus:border-primary" />
					{#if $errors.experience}
						<label for="experience" class="label">
							<span class="label-text-alt text-error">{$errors.experience}</span>
						</label>
					{/if}
				</div>
			{/if}
			{#if season === 9}
				<div class="form-control col-span-12 w-full sm:col-span-4">
					<label for="level" class="label">
						<span class="label-text">Level</span>
					</label>
					<input
						type="number"
						name="level"
						min="0"
						bind:value={$form.level}
						class="input input-bordered w-full focus:border-primary"
					/>
					{#if $errors.level}
						<label for="level" class="label">
							<span class="label-text-alt text-error">{$errors.level}</span>
						</label>
					{/if}
				</div>
			{/if}
			{#if season === 8}
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<label for="acp" class="label">
						<span class="label-text">ACP</span>
					</label>
					<input
						type="number"
						name="acp"
						min="0"
						bind:value={$form.acp}
						class="input input-bordered w-full focus:border-primary"
					/>
					{#if $errors.acp}
						<label for="acp" class="label">
							<span class="label-text-alt text-error">{$errors.acp}</span>
						</label>
					{/if}
				</div>
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<label for="tcp" class="label">
						<span class="label-text">TCP</span>
					</label>
					<input type="number" name="tcp" bind:value={$form.tcp} class="input input-bordered w-full focus:border-primary" />
					{#if $errors.tcp}
						<label for="tcp" class="label">
							<span class="label-text-alt text-error">{$errors.tcp}</span>
						</label>
					{/if}
				</div>
			{/if}
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<label for="gold" class="label">
					<span class="label-text">Gold</span>
				</label>
				<input type="number" name="gold" bind:value={$form.gold} class="input input-bordered w-full focus:border-primary" />
				{#if $errors.gold}
					<label for="gold" class="label">
						<span class="label-text-alt text-error">{$errors.gold}</span>
					</label>
				{/if}
			</div>
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<label for="dtd" class="label">
					<span class="label-text overflow-hidden text-ellipsis whitespace-nowrap">Downtime Days</span>
				</label>
				<input type="number" name="dtd" bind:value={$form.dtd} class="input input-bordered w-full focus:border-primary" />
				{#if $errors.dtd}
					<label for="dtd" class="label">
						<span class="label-text-alt text-error">{$errors.dtd}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="form-control col-span-12 w-full">
			<label for="description" class="label">
				<span class="label-text">Notes</span>
			</label>
			<div
				class={twMerge(
					"no-script-hide tabs-boxed tabs",
					"rounded-b-none border-[1px] border-b-0 border-base-content [--tw-border-opacity:0.2]"
				)}
			>
				<button
					type="button"
					class="tab"
					class:tab-active={!previews.description}
					on:click={() => (previews.description = false)}
				>
					Edit
				</button>
				<button type="button" class="tab" class:tab-active={previews.description} on:click={() => (previews.description = true)}>
					Preview
				</button>
			</div>
			<AutoResizeTextArea
				name="description"
				bind:value={$form.description}
				class={twMerge("textarea textarea-bordered w-full rounded-t-none focus:border-primary", previews.description && "hidden")}
			/>
			<div
				class="border-[1px] border-base-content bg-base-100 p-4 [--tw-border-opacity:0.2]"
				class:hidden={!previews.description}
			>
				<Markdown content={$form.description || ""} />
			</div>
			<label for="description" class="label">
				{#if $errors.description}
					<span class="label-text-alt text-error">{$errors.description}</span>
				{:else}
					<span class="label-text-alt" />
				{/if}
				<span class="label-text-alt">Markdown Allowed</span>
			</label>
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
		<noscript class="col-span-12 flex flex-wrap justify-center gap-4 text-center font-bold">
			<div>JavaScript is required to add/remove magic items and story awards.</div>
		</noscript>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#each $form.magic_items_gained as item, index}
				<div class="card col-span-12 h-[338px] bg-base-300/70 sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Add Magic Item</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<label for={`magic_items_gained.${index}.name`} class="label">
									<span class="label-text">Name</span>
								</label>
								<input
									type="text"
									name={`magic_items_gained.${index}.name`}
									value={item.name}
									on:input={(e) => {
										if ($form.magic_items_gained[index]) $form.magic_items_gained[index].name = e.currentTarget.value;
									}}
									class="input input-bordered w-full focus:border-primary"
								/>
								{#if $errors.magic_items_gained?.[index]?.name}
									<label for={`magic_items_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{$errors.magic_items_gained?.[index]?.name}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
								on:click={() => ($form.magic_items_gained = $form.magic_items_gained.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="form-control w-full">
							<label for={`magic_items_gained.${index}.description`} class="label">
								<span class="label-text">Description</span>
							</label>
							<textarea
								name={`magic_items_gained.${index}.description`}
								on:input={(e) => {
									if ($form.magic_items_gained[index]) $form.magic_items_gained[index].description = e.currentTarget.value;
								}}
								class="textarea textarea-bordered w-full focus:border-primary"
								style="resize: none;"
								value={item.description}
								spellcheck="true"
							/>
							<label for={`magic_items_gained.${index}.description`} class="label">
								<span class="label-text-alt text-error" />
								<span class="label-text-alt">Markdown Allowed</span>
							</label>
						</div>
					</div>
				</div>
			{/each}
			{#each $form.story_awards_gained as item, index}
				<div class="card col-span-12 h-[338px] bg-base-300/70 sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Add Story Award</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<label for={`story_awards_gained.${index}.name`} class="label">
									<span class="label-text">Name</span>
								</label>
								<input
									type="text"
									name={`story_awards_gained.${index}.name`}
									value={item.name}
									on:input={(e) => {
										if ($form.story_awards_gained[index]) $form.story_awards_gained[index].name = e.currentTarget.value;
									}}
									class="input input-bordered w-full focus:border-primary"
								/>
								{#if $errors.story_awards_gained?.[index]?.name}
									<label for={`story_awards_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{$errors.story_awards_gained?.[index]?.name}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
								on:click={() => ($form.story_awards_gained = $form.story_awards_gained.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="form-control w-full">
							<label for={`story_awards_gained.${index}.description`} class="label">
								<span class="label-text">Description</span>
							</label>
							<textarea
								name={`story_awards_gained.${index}.description`}
								on:input={(e) => {
									if ($form.story_awards_gained[index]) $form.story_awards_gained[index].description = e.currentTarget.value;
								}}
								class="textarea textarea-bordered w-full focus:border-primary"
								style="resize: none;"
								value={item.description}
								spellcheck="true"
							/>
							<label for={`story_awards_gained.${index}.description`} class="label">
								<span class="label-text-alt text-error" />
								<span class="label-text-alt">Markdown Allowed</span>
							</label>
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
</SuperForm>
