<script lang="ts">
	import AutoFillSelect from "$lib/components/AutoFillSelect.svelte";
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import Meta from "$lib/components/Meta.svelte";
	import { getMagicItems, getStoryAwards } from "$lib/entities.js";
	import { formatDate } from "$lib/misc.js";
	import { logSchema } from "$lib/types/zod-schema.js";
	import Icon from "$src/lib/components/Icon.svelte";
	import SchemaForm from "$src/lib/components/SchemaForm.svelte";
	import type { DungeonMaster } from "@prisma/client";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const character = data.character;
	let log = data.log;

	let saving = false;
	let errors: Record<string, string> = {};

	$: values = {
		...log,
		characterId: character?.id || "",
		characterName: character?.name || "",
		description: log.description || "",
		magic_items_gained: magicItemsGained,
		magic_items_lost: magicItemsLost,
		story_awards_gained: storyAwardsGained,
		story_awards_lost: storyAwardsLost,
		dm: {
			id: log.dm?.id || "",
			name: log.dm?.name || "",
			DCI: log.dm?.DCI || null,
			uid: log.dm?.uid || ""
		}
	};

	const setDM = (dm?: DungeonMaster) => {
		log = {
			...log,
			dm: {
				id: dm?.id || "",
				name: dm?.name || "",
				DCI: dm?.DCI || null,
				uid: dm?.uid || ""
			}
		};
	};

	const setDMName = (name: string) => {
		log = {
			...log,
			dm: {
				id: log.dm?.id || "",
				name,
				DCI: log.dm?.DCI || null,
				uid: log.dm?.uid || ""
			}
		};
	};

	const setDMDCI = (DCI: string | null) => {
		log = {
			...log,
			dm: {
				id: log.dm?.id || "",
				name: log.dm?.name || "",
				DCI,
				uid: log.dm?.uid || ""
			}
		};
	};

	let season: 1 | 8 | 9 = log.experience ? 1 : log.acp ? 8 : 9;
	let magicItemsGained = log.magic_items_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));
	let magicItemsLost = log.magic_items_lost.map((mi) => mi.id);
	let storyAwardsGained = log.story_awards_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));
	let storyAwardsLost = log.story_awards_lost.map((mi) => mi.id);

	$: magicItems = character
		? getMagicItems(character, { excludeDropped: true, lastLogId: data.logId === "new" ? "" : data.logId }).sort((a, b) =>
				a.name.localeCompare(b.name)
		  )
		: [];
	$: storyAwards = character
		? getStoryAwards(character, { excludeDropped: true, lastLogId: data.logId === "new" ? "" : data.logId }).sort((a, b) =>
				a.name.localeCompare(b.name)
		  )
		: [];

	const addMagicItem = () => (magicItemsGained = [...magicItemsGained, { id: "", name: "", description: "" }]);
	const removeMagicItem = (index: number) => (magicItemsGained = magicItemsGained.filter((_, i) => i !== index));
	const addLostMagicItem = () => (magicItemsLost = [...magicItemsLost, magicItems[0]?.id || ""]);
	const removeLostMagicItem = (index: number) => (magicItemsLost = magicItemsLost.filter((_, i) => i !== index));

	const addStoryAward = () => (storyAwardsGained = [...storyAwardsGained, { id: "", name: "", description: "" }]);
	const removeStoryAward = (index: number) => (storyAwardsGained = storyAwardsGained.filter((_, i) => i !== index));
	const addLostStoryAward = () => (storyAwardsLost = [...storyAwardsLost, storyAwards[0]?.id || ""]);
	const removeLostStoryAward = (index: number) => (storyAwardsLost = storyAwardsLost.filter((_, i) => i !== index));
</script>

{#if data.logId == "new"}
	<Meta title="{character.name} - New Log" />
{:else}
	<Meta title="Edit {log.name}" />
{/if}

<div class="breadcrumbs mb-4 text-sm">
	<ul>
		<li>
			<Icon src="home" class="w-4" />
		</li>
		<li>
			<a href="/characters" class="text-secondary">Characters</a>
		</li>
		<li>
			<a href={`/characters/${data.characterId}`} class="text-secondary">
				{character.name}
			</a>
		</li>
		{#if log.name}
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

<SchemaForm action="?/saveLog" data={values} bind:form bind:saving bind:errors schema={logSchema} stringify="log">
	<input type="hidden" name="characterId" value={character.id} />
	<input type="hidden" name="logId" value={data.logId === "new" ? "" : data.logId} />
	<input type="hidden" name="is_dm_log" value={log.is_dm_log} />
	<div class="grid grid-cols-12 gap-4">
		{#if !log.is_dm_log}
			<div class="form-control col-span-12 sm:col-span-4">
				<label for="type" class="label">
					<span class="label-text">Log Type</span>
				</label>
				<select name="type" bind:value={log.type} disabled={saving} class="select-bordered select w-full">
					<option value="game">Game</option>
					<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
				</select>
			</div>
		{/if}
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6" : "sm:col-span-4")}>
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
				disabled={saving}
				bind:value={log.name}
				class="input-bordered input w-full focus:border-primary"
				aria-invalid={errors.name ? "true" : "false"}
			/>
			<label for="name" class="label">
				<span class="label-text-alt text-error">{errors.name || ""}</span>
			</label>
		</div>
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6" : "sm:col-span-4")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<input
				type="datetime-local"
				name="date"
				required
				disabled={saving}
				value={formatDate(log.date)}
				on:input={(e) => {
					log.date = new Date(e.currentTarget.value);
				}}
				class="input-bordered input w-full focus:border-primary"
				aria-invalid={errors.date ? "true" : "false"}
			/>
			<label for="date" class="label">
				<span class="label-text-alt text-error">{errors.date || ""}</span>
			</label>
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#if log.type === "game"}
				<input type="hidden" name="dmId" value={log.dm?.id || ""} />
				{#if log.is_dm_log}
					<input type="hidden" name="dmName" value={log.dm?.name || ""} />
					<input type="hidden" name="dmDCI" value={log.dm?.DCI || ""} />
					<input type="hidden" name="dmUID" value={log.dm?.uid || ""} />
				{:else}
					<div class="form-control col-span-12 sm:col-span-6">
						<label for="dmName" class="label">
							<span class="label-text">DM Name</span>
						</label>
						<AutoFillSelect
							name="dmName"
							value={log.dm?.name || ""}
							disabled={saving}
							values={data.dms.map((dm) => ({ key: dm.name, value: dm.name + (dm.DCI ? ` (${dm.DCI})` : "") })) || []}
							onSelect={(val) => {
								const dm = data.dms.find((dm) => dm.name === val);
								if (dm) setDM(dm);
								else setDMName(val.toString());
							}}
						/>
						<label for="dmName" class="label">
							<span class="label-text-alt text-error">{errors.dmName || ""}</span>
						</label>
					</div>
					<div class="form-control col-span-12 sm:col-span-6">
						<label for="dmDCI" class="label">
							<span class="label-text">DM DCI</span>
						</label>
						<AutoFillSelect
							name="dmDCI"
							value={log.dm?.DCI || ""}
							disabled={saving}
							values={data.dms.map((dm) => ({ key: dm.DCI, value: dm.name + (dm.DCI ? ` (${dm.DCI})` : "") })) || []}
							onSelect={(val) => {
								const dm = data.dms.find((dm) => dm.name === val);
								if (dm) setDM(dm);
								else setDMDCI(val.toString());
							}}
						/>
						<label for="dmDCI" class="label">
							<span class="label-text-alt text-error">{errors.dmDCI || ""}</span>
						</label>
					</div>
				{/if}
				<div class="form-control col-span-12 sm:col-span-4">
					<label for="season" class="label">
						<span class="label-text">Season</span>
					</label>
					<select name="season" bind:value={season} disabled={saving} class="select-bordered select w-full">
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
							name="experience"
							min="0"
							disabled={saving}
							bind:value={log.experience}
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
							max={Math.max(log.level, character ? 20 - character.total_level : 19)}
							disabled={saving}
							bind:value={log.level}
							class="input-bordered input w-full focus:border-primary"
						/>
						<label for="level" class="label">
							<span class="label-text-alt text-error">{errors.level || ""}</span>
						</label>
					</div>
				{/if}
			{/if}
			{#if season === 8 || log.type === "nongame"}
				{#if log.type === "game"}
					<div class="form-control col-span-6 w-full sm:col-span-2">
						<label for="acp" class="label">
							<span class="label-text">ACP</span>
						</label>
						<input
							type="number"
							name="acp"
							disabled={saving}
							bind:value={log.acp}
							class="input-bordered input w-full focus:border-primary"
						/>
						<label for="acp" class="label">
							<span class="label-text-alt text-error">{errors.acp || ""}</span>
						</label>
					</div>
				{/if}
				<div class={twMerge("form-control w-full", log.type === "nongame" ? "col-span-4" : "col-span-6 sm:col-span-2")}>
					<label for="tcp" class="label">
						<span class="label-text">TCP</span>
					</label>
					<input
						type="number"
						name="tcp"
						disabled={saving}
						bind:value={log.tcp}
						class="input-bordered input w-full focus:border-primary"
					/>
					<label for="tcp" class="label">
						<span class="label-text-alt text-error">{errors.tcp || ""}</span>
					</label>
				</div>
			{/if}
			<div class={twMerge("form-control w-full", log.type === "game" ? "col-span-12 sm:col-span-2" : "col-span-4")}>
				<label for="gold" class="label">
					<span class="label-text">Gold</span>
				</label>
				<input
					type="number"
					name="gold"
					disabled={saving}
					bind:value={log.gold}
					class="input-bordered input w-full focus:border-primary"
				/>
				<label for="gold" class="label">
					<span class="label-text-alt text-error">{errors.gold || ""}</span>
				</label>
			</div>
			<div class={twMerge("form-control w-full", log.type === "game" ? "col-span-12 sm:col-span-2" : "col-span-4")}>
				<label for="dtd" class="label">
					<span class="label-text overflow-hidden text-ellipsis whitespace-nowrap">Downtime Days</span>
				</label>
				<input
					type="number"
					name="dtd"
					disabled={saving}
					bind:value={log.dtd}
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
			{#if !log.is_dm_log && magicItems.filter((item) => !magicItemsLost.includes(item.id)).length > 0}
				<button type="button" class="btn-sm btn min-w-fit flex-1 sm:flex-none" on:click={addLostMagicItem} disabled={saving}>
					Drop Magic Item
				</button>
			{/if}
			{#if log.type === "game"}
				<button
					type="button"
					class="btn-primary btn-sm btn min-w-fit flex-1 sm:flex-none"
					on:click={addStoryAward}
					disabled={saving}
				>
					Add Story Award
				</button>
				{#if !log.is_dm_log && storyAwards.filter((item) => !storyAwardsLost.includes(item.id)).length > 0}
					<button type="button" class="btn-sm btn min-w-fit flex-1 sm:flex-none" on:click={addLostStoryAward} disabled={saving}>
						Drop Story Award
					</button>
				{/if}
			{/if}
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#each magicItemsGained as item, index}
				<div class="card col-span-12 h-[370px] bg-base-300/70 sm:col-span-6">
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
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeMagicItem(index)}>
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
			{#each magicItemsLost as id, index}
				<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Drop Magic Item</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<label for={`magic_items_lost.${index}`} class="label">
									<span class="label-text">Select an Item</span>
								</label>
								<select
									value={id}
									name={`magic_items_lost.${index}`}
									on:change={(e) => {
										magicItemsLost = magicItemsLost.map((item, i) => (i === index ? e.currentTarget.value : item));
									}}
									disabled={saving}
									class="select-bordered select w-full"
								>
									{#each [...log.magic_items_lost.filter((i) => i.id === id), ...magicItems] as item}
										<option value={item.id}>
											{item.name}
										</option>
									{/each}
								</select>
								<label for={`magic_items_lost.${index}`} class="label">
									<span class="label-text-alt text-error">{errors[`magic_items_lost.${index}`] || ""}</span>
								</label>
							</div>
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeLostMagicItem(index)}>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{magicItems.find((item) => magicItemsLost[index] === item.id)?.description}</div>
					</div>
				</div>
			{/each}
			{#each storyAwardsGained as item, index}
				<div class="card col-span-12 h-[370px] bg-base-300/70 sm:col-span-6">
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
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeStoryAward(index)}>
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
			{#each storyAwardsLost as id, index}
				<div class="card col-span-12 bg-base-300/70 shadow-xl sm:col-span-6">
					<div class="card-body flex flex-col gap-4">
						<h4 class="text-2xl">Drop Story Award</h4>
						<div class="flex gap-4">
							<div class="form-control flex-1">
								<label for={`story_awards_lost.${index}`} class="label">
									<span class="label-text">Select an Item</span>
								</label>
								<select
									value={id}
									name={`story_awards_lost.${index}`}
									on:change={(e) => {
										storyAwardsLost = storyAwardsLost.map((item, i) => (i === index ? e.currentTarget.value : item));
									}}
									disabled={saving}
									class="select-bordered select w-full"
								>
									{#each [...log.story_awards_lost.filter((i) => i.id === id), ...storyAwards] as item}
										<option value={item.id}>
											{item.name}
										</option>
									{/each}
								</select>
								<label for={`story_awards_lost.${index}`} class="label">
									<span class="label-text-alt text-error">{errors[`story_awards_lost.${index}`] || ""}</span>
								</label>
							</div>
							<button type="button" class="btn-danger btn mt-9" on:click={() => removeLostStoryAward(index)}>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{storyAwards.find((item) => storyAwardsLost[index] === item.id)?.description}</div>
					</div>
				</div>
			{/each}
		</div>
		<div class="col-span-12 text-center">
			<button type="submit" class={twMerge("btn-primary btn", saving && "loading")} disabled={saving}>Save Log</button>
		</div>
	</div>
</SchemaForm>