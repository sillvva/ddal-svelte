<script lang="ts">
	import AutoFillSelect from "$lib/components/AutoFillSelect.svelte";
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import Meta from "$lib/components/Meta.svelte";
	import { formatDate } from "$lib/misc";
	import { logSchema } from "$lib/types/zod-schema.js";
	import Icon from "$src/lib/components/Icon.svelte";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";
	import { twMerge } from "tailwind-merge";
	import type { z } from "zod";

	export let data;
	export let form;

	let log = data.log;
	let character = data.character;

	let saving = false;
	let errors: Record<string, string> = {};

	$: values = {
		...log,
		applied_date: log.applied_date?.getTime() == 0 ? null : log.applied_date,
		characterId: character?.id || "",
		characterName: character?.name || "",
		description: log.description || "",
		magic_items_gained: magicItemsGained,
		magic_items_lost: [],
		story_awards_gained: storyAwardsGained,
		story_awards_lost: [],
		dm: {
			id: log.dm?.id || "",
			name: log.dm?.name || "",
			DCI: log.dm?.DCI || null,
			uid: log.dm?.uid || ""
		}
	};

	function extraErrors(log: z.infer<typeof logSchema>) {
		if (log.characterId && !(data.characters || []).find((c) => c.id === log.characterId)) {
			errors["characterId"] = "Character not found";
		}

		if (character?.name && !log.applied_date) {
			errors["applied_date"] = "Applied date is required if assigned character is entered";
		}

		if (log.applied_date && !log.characterId) {
			errors["characterId"] = "Assigned character is required if applied date is entered";
		}
	}

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

	const addMagicItem = () => (magicItemsGained = [...magicItemsGained, { id: "", name: "", description: "" }]);
	const removeMagicItem = (index: number) => (magicItemsGained = magicItemsGained.filter((_, i) => i !== index));

	const addStoryAward = () => (storyAwardsGained = [...storyAwardsGained, { id: "", name: "", description: "" }]);
	const removeStoryAward = (index: number) => (storyAwardsGained = storyAwardsGained.filter((_, i) => i !== index));
</script>

{#if data.logId == "new"}
	<Meta title="New Log" />
{:else}
	<Meta title="Edit {log.name}" />
{/if}

<div class="breadcrumbs mb-4 text-sm">
	<ul>
		<li>
			<Icon src="home" class="w-4" />
		</li>
		<li>
			<a href="/dm-logs" class="text-secondary">DM Logs</a>
		</li>
		{#if data.logId !== "new"}
			<li class="overflow-hidden text-ellipsis whitespace-nowrap dark:drop-shadow-md">{log.name}</li>
		{:else}
			<li class="dark:drop-shadow-md">New Log</li>
		{/if}
	</ul>
</div>

{#if form?.error}
	<div class="alert alert-error mb-4 shadow-lg">
		<Icon src="alert-circle" class="w-6" />
		{form.error}
	</div>
{/if}

<SchemaForm
	action="?/saveLog"
	data={values}
	bind:form
	bind:errors
	schema={logSchema}
	stringify="log"
	on:check-errors={() => extraErrors(values)}
	on:before-submit={() => {
		if (log.applied_date?.getTime() === 0) {
			log.applied_date = null;
		}
	}}
>
	<input type="hidden" name="logId" value={data.logId === "new" ? "" : data.logId} />
	<input type="hidden" name="dm.id" value={log.dm?.id || ""} />
	<input type="hidden" name="dm.DCI" value={null} />
	<input type="hidden" name="dm.name" value={log.dm?.name || ""} />
	<input type="hidden" name="dm.uid" value={log.dm?.uid || ""} />
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
				disabled={saving}
				class="input-bordered input w-full focus:border-primary"
				aria-invalid={errors.name ? "true" : "false"}
			/>
			<label for="name" class="label">
				<span class="label-text-alt text-error">{errors.name || ""}</span>
			</label>
		</div>
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6 lg:col-span-3" : "sm:col-span-4")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<input
				type="datetime-local"
				name="date"
				value={log.date.getTime() > 0 ? formatDate(log.date) : ""}
				on:blur={(e) =>
					(log.date = formatDate(e.currentTarget.value) !== "Invalid Date" ? new Date(e.currentTarget.value) : new Date(0))}
				required
				disabled={saving}
				class="input-bordered input w-full focus:border-primary"
			/>
			<label for="date" class="label">
				<span class="label-text-alt text-error">{errors.date || ""}</span>
			</label>
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
			<AutoFillSelect
				type="text"
				name="characterName"
				value={data.characters.find((c) => c.id === log.characterId)?.name || ""}
				on:input={(e) => {
					log.characterId = "";
					log.applied_date = null;
				}}
				disabled={saving}
				required={!!log.applied_date}
				values={data.characters?.map((char) => ({ key: char.id, value: char.name })) || []}
				searchBy="value"
				onSelect={(val) => {
					const character = data.characters.find((c) => c.id === val);
					if (character) {
						log.characterId = val.toString();
					} else {
						log.characterId = "";
					}
					log.applied_date = null;
				}}
			/>
			<label for="characterName" class="label">
				<span class="label-text-alt text-error">{errors.characterId || ""}</span>
			</label>
		</div>
		<div class={twMerge("form-control col-span-12", "sm:col-span-6 lg:col-span-3")}>
			<label for="applied_date" class="label">
				<span class="label-text">
					Assigned Date
					{#if log.characterId}
						<span class="text-error">*</span>
					{/if}
				</span>
			</label>
			<input
				type="datetime-local"
				name="applied_date"
				value={log.applied_date ? formatDate(log.applied_date) : ""}
				on:blur={(e) =>
					(log.applied_date = formatDate(e.currentTarget.value) !== "Invalid Date" ? new Date(e.currentTarget.value) : null)}
				required={!!log.characterId}
				disabled={saving}
				class="input-bordered input w-full focus:border-primary"
				aria-invalid={errors.applied_date ? "true" : "false"}
			/>
			<label for="applied_date" class="label">
				<span class="label-text-alt text-error">{errors.applied_date || ""}</span>
			</label>
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			<div class="form-control col-span-12 sm:col-span-4">
				<label for="season" class="label">
					<span class="label-text">Season</span>
				</label>
				<select bind:value={season} disabled={saving} class="select-bordered select w-full">
					<option value={9}>Season 9+</option>
					<option value={8}>Season 8</option>
					<option value={1}>Season 1-7</option>
				</select>
			</div>
			{#if season === 1}
				<div class="form-control col-span-6 w-full sm:col-span-4">
					<label for="experience" class="label">
						<span class="label-text">Experience</span>
					</label>
					<input
						type="number"
						bind:value={log.experience}
						min="0"
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="experience" class="label">
						<span class="label-text-alt text-error">{errors.experience || ""}</span>
					</label>
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
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="level" class="label">
						<span class="label-text-alt text-error">{errors.level || ""}</span>
					</label>
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
						bind:value={log.acp}
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="acp" class="label">
						<span class="label-text-alt text-error">{errors.acp || ""}</span>
					</label>
				</div>
				<div class={twMerge("form-control w-full", "col-span-6 sm:col-span-2")}>
					<label for="tcp" class="label">
						<span class="label-text">TCP</span>
					</label>
					<input
						type="number"
						name="tcp"
						bind:value={log.tcp}
						disabled={saving}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="tcp" class="label">
						<span class="label-text-alt text-error">{errors.tcp || ""}</span>
					</label>
				</div>
			{/if}
			<div class={twMerge("form-control w-full", "col-span-12 sm:col-span-2")}>
				<label for="gold" class="label">
					<span class="label-text">Gold</span>
				</label>
				<input
					type="number"
					name="gold"
					bind:value={log.gold}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="gold" class="label">
					<span class="label-text-alt text-error">{errors.gold || ""}</span>
				</label>
			</div>
			<div class={twMerge("form-control w-full", "col-span-12 sm:col-span-2")}>
				<label for="dtd" class="label">
					<span class="label-text overflow-hidden text-ellipsis whitespace-nowrap">Downtime Days</span>
				</label>
				<input
					type="number"
					name="dtd"
					bind:value={log.dtd}
					disabled={saving}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="dtd" class="label">
					<span class="label-text-alt text-error">{errors.dtd || ""}</span>
				</label>
			</div>
		</div>
		<div class="form-control col-span-12 w-full">
			<label for="description" class="label">
				<span class="label-text">Notes</span>
			</label>
			<AutoResizeTextArea
				name="description"
				bind:value={log.description}
				disabled={saving}
				class="textarea-bordered textarea w-full focus:border-primary"
			/>
			<label for="description" class="label">
				<span class="label-text-alt text-error">{errors.description || ""}</span>
				<span class="label-text-alt">Markdown Allowed</span>
			</label>
		</div>
		<div class="col-span-12 flex flex-wrap gap-4">
			<button
				type="button"
				class="btn-primary btn-sm btn min-w-fit flex-1 sm:flex-none"
				on:click={addMagicItem}
				disabled={saving}
			>
				Add Magic Item
			</button>
			<button
				type="button"
				class="btn-primary btn-sm btn min-w-fit flex-1 sm:flex-none"
				on:click={addStoryAward}
				disabled={saving}
			>
				Add Story Award
			</button>
		</div>
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
									on:change={(e) => {
										magicItemsGained = magicItemsGained.map((item, i) =>
											i === index ? { ...item, name: e.currentTarget.value } : item
										);
									}}
									disabled={saving}
									class="input-bordered input w-full focus:border-primary"
								/>
								<label for={`magic_items_gained.${index}.name`} class="label">
									<span class="label-text-alt text-error">{errors[`magic_items_gained.${index}.name`] || ""}</span>
								</label>
							</div>
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeMagicItem(index)} disabled={saving}>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="form-control w-full">
							<label for={`magic_items_gained.${index}.description`} class="label">
								<span class="label-text">Description</span>
							</label>
							<textarea
								name={`magic_items_gained.${index}.description`}
								on:change={(e) => {
									magicItemsGained = magicItemsGained.map((item, i) =>
										i === index ? { ...item, description: e.currentTarget.value } : item
									);
								}}
								disabled={saving}
								class="textarea-bordered textarea w-full focus:border-primary"
								style="resize: none;"
								value={item.description}
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
									on:change={(e) => {
										storyAwardsGained = storyAwardsGained.map((item, i) =>
											i === index ? { ...item, name: e.currentTarget.value } : item
										);
									}}
									disabled={saving}
									class="input-bordered input w-full focus:border-primary"
								/>
								<label for={`story_awards_gained.${index}.name`} class="label">
									<span class="label-text-alt text-error">{errors[`story_awards_gained.${index}.name`] || ""}</span>
								</label>
							</div>
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeStoryAward(index)} disabled={saving}>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="form-control w-full">
							<label for={`story_awards_gained.${index}.description`} class="label">
								<span class="label-text">Description</span>
							</label>
							<textarea
								name={`story_awards_gained.${index}.description`}
								on:change={(e) => {
									storyAwardsGained = storyAwardsGained.map((item, i) =>
										i === index ? { ...item, description: e.currentTarget.value } : item
									);
								}}
								disabled={saving}
								class="textarea-bordered textarea w-full focus:border-primary"
								style="resize: none;"
								value={item.description}
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
			<button type="submit" class={twMerge("btn-primary btn", saving && "loading")} disabled={saving}>Save Log</button>
		</div>
	</div>
</SchemaForm>