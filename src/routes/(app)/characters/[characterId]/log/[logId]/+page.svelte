<script lang="ts">
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import BackButton from "$lib/components/BackButton.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import SchemaForm from "$lib/components/SchemaForm.svelte";
	import { getMagicItems, getStoryAwards } from "$lib/entities";
	import { sorter } from "$lib/utils";
	import ComboBox from "$src/lib/components/ComboBox.svelte";
	import DateTimeInput from "$src/lib/components/DateTimeInput.svelte";
	import Markdown from "$src/lib/components/Markdown.svelte";
	import { logSchema, type LogSchema } from "$src/lib/types/schemas";
	import { twMerge } from "tailwind-merge";

	export let data;
	export let form;

	const character = data.character;
	let log = data.log;

	$: magicItems = character
		? getMagicItems(character, { excludeDropped: true, lastLogDate: new Date(log.date).toISOString() }).sort((a, b) =>
				sorter(a.name, b.name)
		  )
		: [];
	$: storyAwards = character
		? getStoryAwards(character, { excludeDropped: true, lastLogDate: new Date(log.date).toISOString() }).sort((a, b) =>
				sorter(a.name, b.name)
		  )
		: [];

	const defaultDM = { id: "", name: "", DCI: null, uid: "" };
	let dm = log.dm || defaultDM;
	let previews = {
		description: false
	};

	let season: 1 | 8 | 9 = log.experience ? 1 : log.acp ? 8 : 9;
	let magicItemsGained = log.magic_items_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));
	$: magicItemsLost = log.magic_items_lost.map((mi) => mi.id).filter((id) => !!magicItems.find((mi) => mi.id === id));
	let storyAwardsGained = log.story_awards_gained.map((mi) => ({
		id: mi.id,
		name: mi.name,
		description: mi.description || ""
	}));
	$: storyAwardsLost = log.story_awards_lost.map((mi) => mi.id).filter((id) => !!storyAwards.find((mi) => mi.id === id));

	$: values = {
		...log,
		characterId: log.characterId || character?.id || "",
		characterName: character?.name || "",
		description: log.description || "",
		magic_items_gained: magicItemsGained,
		magic_items_lost: magicItemsLost,
		story_awards_gained: storyAwardsGained,
		story_awards_lost: storyAwardsLost,
		dm:
			!(dm.uid || dm.name.trim()) && data.session?.user?.id
				? {
						id: "",
						name: data.session.user.name || "Me",
						DCI: null,
						uid: data.session.user.id
				  }
				: {
						id: dm.id,
						name: dm.name.trim(),
						DCI: dm.DCI,
						uid: dm.uid
				  }
	} satisfies LogSchema;

	export const snapshot = {
		capture: () => ({
			log,
			dm,
			magicItemsGained,
			magicItemsLost,
			storyAwardsGained,
			storyAwardsLost
		}),
		restore: (values) => {
			log = values.log;
			dm = values.dm;
			magicItemsGained = values.magicItemsGained;
			magicItemsLost = values.magicItemsLost;
			storyAwardsGained = values.storyAwardsGained;
			storyAwardsLost = values.storyAwardsLost;
		}
	};
</script>

<BreadCrumbs />
<BackButton href={`/characters/${data.characterId}`}>{character.name}</BackButton>

<SchemaForm action="?/saveLog" schema={logSchema} data={values} let:saving let:errors>
	{#if form?.error || errors.form}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{form?.error || errors.form}
		</div>
	{/if}

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
			{#if errors.name}
				<label for="name" class="label">
					<span class="label-text-alt text-error">{errors.name}</span>
				</label>
			{/if}
		</div>
		<div class={twMerge("form-control col-span-12", log.is_dm_log ? "sm:col-span-6" : "sm:col-span-4")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<DateTimeInput
				name="date"
				required
				disabled={saving}
				bind:value={log.date}
				class="input-bordered input w-full focus:border-primary"
				aria-invalid={errors.date ? "true" : "false"}
			/>
			{#if errors.date}
				<label for="date" class="label">
					<span class="label-text-alt text-error">{errors.date}</span>
				</label>
			{/if}
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#if log.type === "game"}
				<input type="hidden" name="dm.id" value={dm.id} />
				<input type="hidden" name="dm.uid" value={dm.uid} />
				{#if log.is_dm_log}
					<input type="hidden" name="dm.name" value={dm.name} />
					<input type="hidden" name="dm.DCI" value={dm.DCI} />
				{:else}
					<div class="form-control col-span-6">
						<label for="dmName" class="label">
							<span class="label-text">DM Name</span>
						</label>
						<ComboBox
							name="dm.name"
							value={dm.name}
							values={data.dms.map((dm) => ({ key: dm.name, value: dm.name + (dm.DCI ? ` (${dm.DCI})` : "") })) || []}
							disabled={saving}
							on:select={(ev) => {
								if (ev.detail) {
									const updated = data.dms.find((dm) => dm.name === ev.detail);
									if (updated) dm = updated;
									else dm = { ...(dm.name ? dm : defaultDM), name: ev.detail.toString().trim() };
								} else dm = defaultDM;
							}}
						/>
						{#if errors.dm.name}
							<label for="dmName" class="label">
								<span class="label-text-alt text-error">{errors.dm.name}</span>
							</label>
						{/if}
					</div>
					<div class="form-control col-span-6">
						<label for="dmDCI" class="label">
							<span class="label-text">DM DCI</span>
						</label>
						<ComboBox
							name="dm.DCI"
							type="number"
							value={dm.DCI}
							values={data.dms.map((dm) => ({ key: dm.DCI, value: dm.name + (dm.DCI ? ` (${dm.DCI})` : "") })) || []}
							disabled={saving}
							on:select={(ev) => {
								if (ev.detail) {
									const updated = data.dms.find((dm) => dm.DCI === ev.detail);
									if (updated) dm = updated;
									else dm = { ...(dm.name ? dm : defaultDM), DCI: ev.detail.toString().trim() };
								} else dm = { ...(dm.name ? dm : defaultDM), DCI: null };
							}}
						/>
						{#if errors.dm.DCI}
							<label for="dmDCI" class="label">
								<span class="label-text-alt text-error">{errors.dm.DCI}</span>
							</label>
						{/if}
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
						{#if errors.experience}
							<label for="experience" class="label">
								<span class="label-text-alt text-error">{errors.experience}</span>
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
							max={Math.max(log.level, character ? 20 - character.total_level : 19)}
							disabled={saving}
							bind:value={log.level}
							class="input-bordered input w-full focus:border-primary"
						/>
						{#if errors.level}
							<label for="level" class="label">
								<span class="label-text-alt text-error">{errors.level}</span>
							</label>
						{/if}
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
						{#if errors.acp}
							<label for="acp" class="label">
								<span class="label-text-alt text-error">{errors.acp}</span>
							</label>
						{/if}
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
					{#if errors.tcp}
						<label for="tcp" class="label">
							<span class="label-text-alt text-error">{errors.tcp}</span>
						</label>
					{/if}
				</div>
			{/if}
			<div class={twMerge("form-control w-full", log.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
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
				{#if errors.gold}
					<label for="gold" class="label">
						<span class="label-text-alt text-error">{errors.gold}</span>
					</label>
				{/if}
			</div>
			<div class={twMerge("form-control w-full", log.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
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
				{#if errors.dtd}
					<label for="dtd" class="label">
						<span class="label-text-alt text-error">{errors.dtd}</span>
					</label>
				{/if}
			</div>
		</div>
		<div class="form-control col-span-12 w-full">
			<label for="description" class="label">
				<span class="label-text">Notes</span>
			</label>
			<div class="tabs tabs-boxed rounded-b-none border-base-content border-b-0 border-[1px] [--tw-border-opacity:0.2]">
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
				disabled={saving}
				class={twMerge("textarea-bordered rounded-t-none textarea w-full focus:border-primary", previews.description && "hidden")}
			/>
			<div
				class="p-4 bg-base-100 border-base-content border-[1px] [--tw-border-opacity:0.2]"
				class:hidden={!previews.description}
			>
				<Markdown content={log.description || ""} />
			</div>
			<label for="description" class="label">
				{#if errors.description}
					<span class="label-text-alt text-error">{errors.description}</span>
				{:else}
					<span class="label-text-alt" />
				{/if}
				<span class="label-text-alt">Markdown Allowed</span>
			</label>
		</div>
		<div class="col-span-12 flex flex-wrap gap-4">
			<button
				type="button"
				class="btn-primary btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
				on:click={() => (magicItemsGained = [...magicItemsGained, { id: "", name: "", description: "" }])}
				disabled={saving}
			>
				Add Magic Item
			</button>
			{#if !log.is_dm_log && magicItems.filter((item) => !magicItemsLost.includes(item.id)).length > 0}
				<button
					type="button"
					class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() => (magicItemsLost = [...magicItemsLost, magicItems[0]?.id || ""])}
					disabled={saving}
				>
					Drop Magic Item
				</button>
			{/if}
			{#if log.type === "game"}
				<button
					type="button"
					class="btn-primary btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
					on:click={() => (storyAwardsGained = [...storyAwardsGained, { id: "", name: "", description: "" }])}
					disabled={saving}
				>
					Add Story Award
				</button>
				{#if !log.is_dm_log && storyAwards.filter((item) => !storyAwardsLost.includes(item.id)).length > 0}
					<button
						type="button"
						class="btn min-w-fit flex-1 sm:btn-sm sm:flex-none"
						on:click={() => (storyAwardsLost = [...storyAwardsLost, storyAwards[0]?.id || ""])}
						disabled={saving}
					>
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
									on:input={(e) => {
										if (magicItemsGained[index]) magicItemsGained[index].name = e.currentTarget.value;
									}}
									disabled={saving}
									class="input-bordered input w-full focus:border-primary"
								/>
								{#if errors.magic_items_gained[index].name}
									<label for={`magic_items_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{errors.magic_items_gained[index].name}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger btn mt-9"
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
									on:input={(e) => {
										if (magicItemsLost[index]) magicItemsLost[index] = e.currentTarget.value;
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
								{#if errors.magic_items_lost[index]}
									<label for={`magic_items_lost.${index}`} class="label">
										<span class="label-text-alt text-error">{errors.magic_items_lost[index]}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger btn mt-9"
								on:click={() => (magicItemsLost = magicItemsLost.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{magicItems.find((item) => magicItemsLost[index] === item.id)?.description || ""}</div>
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
									on:input={(e) => {
										if (storyAwardsGained[index]) storyAwardsGained[index].name = e.currentTarget.value;
									}}
									disabled={saving}
									class="input-bordered input w-full focus:border-primary"
								/>
								{#if errors.story_awards_gained[index].name}
									<label for={`story_awards_gained.${index}.name`} class="label">
										<span class="label-text-alt text-error">{errors.story_awards_gained[index].name}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger btn mt-9"
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
									on:input={(e) => {
										if (storyAwardsLost[index]) storyAwardsLost[index] = e.currentTarget.value;
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
								{#if errors.story_awards_lost[index]}
									<label for={`story_awards_lost.${index}`} class="label">
										<span class="label-text-alt text-error">{errors.story_awards_lost[index]}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger btn mt-9"
								on:click={() => (storyAwardsLost = storyAwardsLost.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{storyAwards.find((item) => storyAwardsLost[index] === item.id)?.description || ""}</div>
					</div>
				</div>
			{/each}
		</div>
		<div class="col-span-12 text-center">
			<button
				type="submit"
				class="btn-primary btn disabled:bg-primary disabled:bg-opacity-50 disabled:text-opacity-50"
				disabled={saving}
			>
				{#if saving}
					<span class="loading" />
				{/if}
				Save Log
			</button>
		</div>
	</div>
</SchemaForm>
