<script lang="ts">
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm from "$lib/components/SchemaForm.svelte";
	import ComboBox from "$src/lib/components/ComboBox.svelte";
	import DateTimeInput from "$src/lib/components/DateTimeInput.svelte";
	import Markdown from "$src/lib/components/Markdown.svelte";
	import { dMLogSchema, type LogSchemaIn } from "$src/lib/types/schemas";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	let log = data.log;
	let character = data.character;
	let previews = {
		description: false
	};

	let season: 1 | 8 | 9 = log.experience ? 1 : log.acp ? 8 : 9;
	let magicItemsGained = log.magic_items_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));
	let storyAwardsGained = log.story_awards_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));

	$: characterId = log.characterId || character?.id;
	$: if (!character && log.characterId && data.characters.find((c) => c.id === log.characterId)) {
		character = data.characters.find((c) => c.id === log.characterId);
	}
	$: values = {
		...log,
		characterId: characterId,
		characterName: data.characters.find((c) => c.id === characterId)?.name || character?.name,
		description: log.description,
		magic_items_gained: magicItemsGained,
		magic_items_lost: [],
		story_awards_gained: storyAwardsGained,
		story_awards_lost: [],
		date: log.date && new Date(log.date),
		applied_date: log.applied_date ? new Date(log.applied_date) : null,
		dm: {
			id: log.dm?.id,
			name: log.dm?.name,
			DCI: log.dm?.DCI,
			uid: log.dm?.uid || data.user.id,
			owner: data.user.id
		}
	} satisfies LogSchemaIn;

	export const snapshot = {
		capture: () => ({
			log,
			magicItemsGained,
			storyAwardsGained
		}),
		restore: (values) => {
			log = values.log;
			magicItemsGained = values.magicItemsGained;
			storyAwardsGained = values.storyAwardsGained;
		}
	};
</script>

<BreadCrumbs />

<SchemaForm
	action="?/saveLog"
	schema={dMLogSchema(data.characters)}
	data={values}
	let:errors
	let:saving
	on:before-submit={() => {
		if (new Date(log.applied_date || 0).getTime() === 0) {
			log.applied_date = null;
		}
	}}
>
	{#if form?.error || errors.has("form")}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form?.error || errors.get("form")}
		</div>
	{/if}

	<input type="hidden" name="id" value={data.logId === "new" ? "" : data.logId} />
	<input type="hidden" name="dm.id" value={log.dm?.id || ""} />
	<input type="hidden" name="dm.DCI" value={null} />
	<input type="hidden" name="dm.name" value={log.dm?.name || ""} />
	<input type="hidden" name="dm.uid" value={log.dm?.uid || ""} />
	<input type="hidden" name="dm.owner" value={data.user.id} />
	<input type="hidden" name="is_dm_log" value="true" />
	<div class="grid grid-cols-12 gap-4">
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6 lg:col-span-3" : "sm:col-span-4")}>
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
				bind:value={log.name}
				class="input input-bordered w-full focus:border-primary"
				aria-invalid={errors.get("name") ? "true" : "false"}
			/>
			{#if errors.has("name")}
				<label for="name" class="label">
					<span class="label-text-alt text-error">{errors.get("name")}</span>
				</label>
			{/if}
		</div>
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6 lg:col-span-3" : "sm:col-span-4")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<DateTimeInput name="date" bind:date={log.date} required class="input input-bordered w-full focus:border-primary" />
			{#if errors.has("date")}
				<label for="date" class="label">
					<span class="label-text-alt text-error">{errors.get("date")}</span>
				</label>
			{/if}
		</div>
		<input type="hidden" name="characterId" bind:value={log.characterId} />
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<label for="characterName" class="label">
				<span class="label-text">
					Assigned Character
					{#if log.applied_date}
						<span class="text-error">*</span>
					{/if}
				</span>
			</label>
			<ComboBox
				type="text"
				name="characterName"
				value={character?.name || ""}
				values={data.characters?.map((char) => ({ key: char.id, value: char.name })) || []}
				required={!!log.applied_date}
				searchBy="value"
				on:input={() => {
					log.characterId = "";
					// log.applied_date = null;
				}}
				on:select={(ev) => {
					character = data.characters.find((c) => c.id === ev.detail);
					log.characterId = character ? ev.detail.toString() : "";
					// log.applied_date = data.character && log.applied_date ? log.applied_date : null;
					if (log.characterId) log.applied_date = log.applied_date || new Date();
				}}
			/>
			{#if errors.has("characterId")}
				<label for="characterName" class="label">
					<span class="label-text-alt text-error">{errors.get("characterId")}</span>
				</label>
			{/if}
		</div>
		<div class="form-control col-span-12 sm:col-span-6 lg:col-span-3">
			<label for="applied_date" class="label">
				<span class="label-text">
					Assigned Date
					{#if log.characterId}
						<span class="text-error">*</span>
					{/if}
				</span>
			</label>
			<DateTimeInput
				name="applied_date"
				bind:date={log.applied_date}
				required={!!log.characterId}
				class="input input-bordered w-full focus:border-primary"
				aria-invalid={errors.get("applied_date") ? "true" : "false"}
			/>
			{#if errors.has("applied_date")}
				<label for="applied_date" class="label">
					<span class="label-text-alt text-error">{errors.get("applied_date")}</span>
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
					<input type="number" bind:value={log.experience} min="0" class="input input-bordered w-full focus:border-primary" />
					{#if errors.has("experience")}
						<label for="experience" class="label">
							<span class="label-text-alt text-error">{errors.get("experience")}</span>
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
						bind:value={log.level}
						class="input input-bordered w-full focus:border-primary"
					/>
					{#if errors.has("level")}
						<label for="level" class="label">
							<span class="label-text-alt text-error">{errors.get("level")}</span>
						</label>
					{/if}
				</div>
			{/if}
			{#if season === 8}
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<label for="acp" class="label">
						<span class="label-text">ACP</span>
					</label>
					<input type="number" name="acp" min="0" bind:value={log.acp} class="input input-bordered w-full focus:border-primary" />
					{#if errors.has("acp")}
						<label for="acp" class="label">
							<span class="label-text-alt text-error">{errors.get("acp")}</span>
						</label>
					{/if}
				</div>
				<div class="form-control col-span-6 w-full sm:col-span-2">
					<label for="tcp" class="label">
						<span class="label-text">TCP</span>
					</label>
					<input type="number" name="tcp" bind:value={log.tcp} class="input input-bordered w-full focus:border-primary" />
					{#if errors.has("tcp")}
						<label for="tcp" class="label">
							<span class="label-text-alt text-error">{errors.get("tcp")}</span>
						</label>
					{/if}
				</div>
			{/if}
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<label for="gold" class="label">
					<span class="label-text">Gold</span>
				</label>
				<input type="number" name="gold" bind:value={log.gold} class="input input-bordered w-full focus:border-primary" />
				{#if errors.has("gold")}
					<label for="gold" class="label">
						<span class="label-text-alt text-error">{errors.get("gold")}</span>
					</label>
				{/if}
			</div>
			<div class="form-control col-span-6 w-full sm:col-span-2">
				<label for="dtd" class="label">
					<span class="label-text overflow-hidden text-ellipsis whitespace-nowrap">Downtime Days</span>
				</label>
				<input type="number" name="dtd" bind:value={log.dtd} class="input input-bordered w-full focus:border-primary" />
				{#if errors.has("dtd")}
					<label for="dtd" class="label">
						<span class="label-text-alt text-error">{errors.get("dtd")}</span>
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
				<button type="button" class="tab" class:tab-active={!previews.description} on:click={() => (previews.description = false)}
					>Edit</button
				>
				<button type="button" class="tab" class:tab-active={previews.description} on:click={() => (previews.description = true)}
					>Preview</button
				>
			</div>
			<AutoResizeTextArea
				name="description"
				bind:value={log.description}
				class={twMerge("textarea textarea-bordered w-full rounded-t-none focus:border-primary", previews.description && "hidden")}
			/>
			<div
				class="border-[1px] border-base-content bg-base-100 p-4 [--tw-border-opacity:0.2]"
				class:hidden={!previews.description}
			>
				<Markdown content={log.description || ""} />
			</div>
			<label for="description" class="label">
				{#if errors.has("description")}
					<span class="label-text-alt text-error">{errors.get("description")}</span>
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
				on:click={() => (magicItemsGained = [...magicItemsGained, { id: "", name: "", description: "" }])}
			>
				Add Magic Item
			</button>
			<button
				type="button"
				class="btn btn-primary min-w-fit flex-1 sm:btn-sm sm:flex-none"
				on:click={() => (storyAwardsGained = [...storyAwardsGained, { id: "", name: "", description: "" }])}
			>
				Add Story Award
			</button>
		</div>
		<noscript class="col-span-12 flex flex-wrap justify-center gap-4 text-center font-bold">
			<div>JavaScript is required to add/remove magic items and story awards.</div>
		</noscript>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#each magicItemsGained as item, index}
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
										if (magicItemsGained[index]) magicItemsGained[index].name = e.currentTarget.value;
									}}
									class="input input-bordered w-full focus:border-primary"
								/>
								{#if errors.has(`magic_items_gained.${index}.name`)}
									<label for={`magic_items_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{errors.get(`magic_items_gained.${index}.name`)}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
								on:click={() => (magicItemsGained = magicItemsGained.filter((_, i) => i !== index))}
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
									if (magicItemsGained[index]) magicItemsGained[index].description = e.currentTarget.value;
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
			{#each storyAwardsGained as item, index}
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
										if (storyAwardsGained[index]) storyAwardsGained[index].name = e.currentTarget.value;
									}}
									class="input input-bordered w-full focus:border-primary"
								/>
								{#if errors.has(`story_awards_gained.${index}.name`)}
									<label for={`story_awards_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{errors.get(`story_awards_gained.${index}.name`)}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
								on:click={() => (storyAwardsGained = storyAwardsGained.filter((_, i) => i !== index))}
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
									if (storyAwardsGained[index]) storyAwardsGained[index].description = e.currentTarget.value;
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
				{#if saving}
					<span class="loading" />
				{/if}
				Save Log
			</button>
		</div>
	</div>
</SchemaForm>
