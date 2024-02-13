<script lang="ts">
	import AutoResizeTextArea from "$lib/components/AutoResizeTextArea.svelte";
	import BreadCrumbs from "$lib/components/BreadCrumbs.svelte";
	import DateTimeInput from "$lib/components/DateTimeInput.svelte";
	import Icon from "$lib/components/Icon.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import SuperForm from "$lib/components/SuperForm.svelte";
	import { defaultDM, getMagicItems, getStoryAwards } from "$lib/entities";
	import { logSchema } from "$lib/schemas";
	import { sorter } from "$lib/util";
	import HComboBox from "$src/lib/components/HComboBox.svelte";
	import { superForm } from "sveltekit-superforms";
	import { valibotClient } from "sveltekit-superforms/adapters";
	import { twMerge } from "tailwind-merge";

	export let data;

	const character = data.character;

	let logForm = superForm(data.form, {
		dataType: "json",
		validators: valibotClient(logSchema),
		taintedMessage: "You have unsaved changes. Are you sure you want to leave?"
	});

	const { form, errors, submitting, message } = logForm;

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
	{#if $message}
		<div class="alert alert-error mb-4 shadow-lg">
			<Icon src="alert-circle" class="w-6" />
			{$message}
		</div>
	{/if}

	<div class="grid grid-cols-12 gap-4">
		<div class="form-control col-span-12 sm:col-span-4">
			<label for="type" class="label">
				<span class="label-text">Log Type</span>
			</label>
			<select name="type" bind:value={$form.type} class="select select-bordered w-full">
				<option value="game">Game</option>
				<option value="nongame">Non-Game (Purchase, Trade, etc)</option>
			</select>
		</div>
		<div class={twMerge("form-control col-span-12 sm:col-span-4")}>
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
		<div class={twMerge("form-control col-span-12 sm:col-span-4")}>
			<label for="date" class="label">
				<span class="label-text">
					Date
					<span class="text-error">*</span>
				</span>
			</label>
			<DateTimeInput
				name="date"
				required
				bind:date={$form.date}
				class="input input-bordered w-full focus:border-primary"
				aria-invalid={$errors.date ? "true" : "false"}
			/>
			{#if $errors.date}
				<label for="date" class="label">
					<span class="label-text-alt text-error">{$errors.date}</span>
				</label>
			{/if}
		</div>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#if $form.type === "game"}
				<div class="form-control col-span-6">
					<label for="dmName" class="label">
						<span class="label-text">DM Name</span>
					</label>
					<HComboBox
						name="dmName"
						bind:value={$form.dm.name}
						values={data.dms.map((dm) => ({
							key: dm.id,
							value: dm.name,
							label: dm.name + (dm.uid === data.user.id ? ` (Me)` : "") + (dm.DCI ? ` (${dm.DCI})` : "")
						})) || []}
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
						on:clear={() => ($form.dm = defaultDM(data.user.id))}
						allowCustom
						clearable
					/>
					{#if $errors.dm?.name}
						<label for="dmName" class="label">
							<span class="label-text-alt text-error">{$errors.dm?.name}</span>
						</label>
					{/if}
				</div>
				<div class="form-control col-span-6">
					<label for="dmDCI" class="label">
						<span class="label-text">DM DCI</span>
					</label>
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
						on:clear={() => ($form.dm = defaultDM(data.user.id))}
						allowCustom
						clearable
					/>
					{#if $errors.dm?.DCI}
						<label for="dmDCI" class="label">
							<span class="label-text-alt text-error">{$errors.dm?.DCI}</span>
						</label>
					{/if}
				</div>
				<div class="form-control col-span-12 sm:col-span-4">
					<label for="season" class="label">
						<span class="label-text">Season</span>
					</label>
					<select id="season" bind:value={season} class="select select-bordered w-full">
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
							bind:value={$form.experience}
							class="input input-bordered w-full focus:border-primary"
						/>
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
							max={Math.max($form.level, character ? 20 - character.total_level : 19)}
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
			{/if}
			{#if season === 8 || $form.type === "nongame"}
				{#if $form.type === "game"}
					<div class="form-control col-span-6 w-full sm:col-span-2">
						<label for="acp" class="label">
							<span class="label-text">ACP</span>
						</label>
						<input type="number" name="acp" bind:value={$form.acp} class="input input-bordered w-full focus:border-primary" />
						{#if $errors.acp}
							<label for="acp" class="label">
								<span class="label-text-alt text-error">{$errors.acp}</span>
							</label>
						{/if}
					</div>
				{/if}
				<div class={twMerge("form-control w-full", $form.type === "nongame" ? "col-span-4" : "col-span-6 sm:col-span-2")}>
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
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
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
			<div class={twMerge("form-control w-full", $form.type === "game" ? "col-span-6 sm:col-span-2" : "col-span-4")}>
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
				<button type="button" class="tab" class:tab-active={!previews.description} on:click={() => (previews.description = false)}
					>Edit</button
				>
				<button type="button" class="tab" class:tab-active={previews.description} on:click={() => (previews.description = true)}
					>Preview</button
				>
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
		<noscript class="col-span-12 flex flex-wrap justify-center gap-4 text-center font-bold">
			<div>JavaScript is required to add/remove magic items and story awards.</div>
		</noscript>
		<div class="col-span-12 grid grid-cols-12 gap-4">
			{#each $form.magic_items_gained as item, index}
				<div class="card col-span-12 bg-base-300/70 sm:col-span-6">
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
							<AutoResizeTextArea
								name={`magic_items_gained.${index}.description`}
								class="textarea textarea-bordered w-full focus:border-primary"
								bind:value={item.description}
								minRows={3}
								maxRows={8}
							/>
							<label for={`magic_items_gained.${index}.description`} class="label">
								<span class="label-text-alt text-error" />
								<span class="label-text-alt">Markdown Allowed</span>
							</label>
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
								<label for={`magic_items_lost.${index}`} class="label">
									<span class="label-text">Select an Item</span>
								</label>
								<select
									value={$form.magic_items_lost[index]}
									on:input={(e) => {
										$form.magic_items_lost[index] = e.currentTarget.value;
									}}
									name={`magic_items_lost.${index}`}
									class="select select-bordered w-full"
								>
									{#each magicItems.filter((item) => item.id === id || !$form.magic_items_lost.includes(item.id)) as item}
										<option value={item.id}>
											{item.name}
										</option>
									{/each}
								</select>
								{#if $errors.magic_items_lost?.[index]}
									<label for={`magic_items_lost.${index}`} class="label">
										<span class="label-text-alt text-error">{$errors.magic_items_lost?.[index]}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
								on:click={() => ($form.magic_items_lost = $form.magic_items_lost.filter((_, i) => i !== index))}
							>
								<Icon src="trash-can" class="w-6" />
							</button>
						</div>
						<div class="text-sm">{magicItems.find((item) => $form.magic_items_lost[index] === item.id)?.description || ""}</div>
					</div>
				</div>
			{/each}
			{#each $form.story_awards_gained as item, index}
				<div class="card col-span-12 bg-base-300/70 sm:col-span-6">
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
							<AutoResizeTextArea
								name={`story_awards_gained.${index}.description`}
								class="textarea textarea-bordered w-full focus:border-primary"
								bind:value={item.description}
								minRows={3}
								maxRows={8}
							/>
							<label for={`story_awards_gained.${index}.description`} class="label">
								<span class="label-text-alt text-error" />
								<span class="label-text-alt">Markdown Allowed</span>
							</label>
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
								<label for={`story_awards_lost.${index}`} class="label">
									<span class="label-text">Select an Item</span>
								</label>
								<select
									value={$form.story_awards_lost[index]}
									on:input={(e) => {
										$form.story_awards_lost[index] = e.currentTarget.value;
									}}
									name={`story_awards_lost.${index}`}
									class="select select-bordered w-full"
								>
									{#each storyAwards.filter((item) => item.id === id || !$form.story_awards_lost.includes(item.id)) as item}
										<option value={item.id}>
											{item.name}
										</option>
									{/each}
								</select>
								{#if $errors.story_awards_lost?.[index]}
									<label for={`story_awards_lost.${index}`} class="label">
										<span class="label-text-alt text-error">{$errors.story_awards_lost?.[index]}</span>
									</label>
								{/if}
							</div>
							<button
								type="button"
								class="btn-danger no-script-hide btn mt-9"
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
