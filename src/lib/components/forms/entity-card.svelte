<script lang="ts">
	import type { DmLogSchemaIn, ItemSchema, LogSchemaIn } from "$lib/schemas";
	import type { RemoteFormFields } from "@sveltejs/kit";
	import Control from "./control.svelte";
	import InputWrapper from "./input-wrapper.svelte";
	import Input from "./input.svelte";
	import MarkdownInput from "./md-input.svelte";

	interface BaseProps {
		entity: "magicItems" | "storyAwards";
		fields: RemoteFormFields<LogSchemaIn> | RemoteFormFields<DmLogSchemaIn>;
		index: number;
	}

	interface AddProps extends BaseProps {
		type: "add";
	}

	interface DropProps extends BaseProps {
		type: "drop";
		items: ItemSchema[];
	}

	type Props = AddProps | DropProps;

	let { entity, fields, index, ...card }: Props = $props();

	const title = entity === "magicItems" ? "Magic Item" : "Story Award";

	const arrValue = $derived(
		card.type === "drop" ? (entity === "magicItems" ? fields.magicItemsLost.value() : fields.storyAwardsLost.value()) : []
	);
	const gainedField = $derived(entity === "magicItems" ? fields.magicItemsGained[index] : fields.storyAwardsGained[index]);
	const lostField = $derived(entity === "magicItems" ? fields.magicItemsLost[index] : fields.storyAwardsLost[index]);

	const ondelete = (ev: Event) => {
		ev.preventDefault();
		if (card.type === "add" && gainedField) {
			if (entity === "magicItems")
				fields.magicItemsGained.set(fields.magicItemsGained.value().filter((it) => it.id !== gainedField.id.value()));
			else fields.storyAwardsGained.set(fields.storyAwardsGained.value().filter((it) => it.id !== gainedField.id.value()));
		}
		if (card.type === "drop" && lostField) {
			if (entity === "magicItems")
				fields.magicItemsLost.set(fields.magicItemsLost.value().filter((it) => it !== lostField.value()));
			else fields.storyAwardsLost.set(fields.storyAwardsLost.value().filter((it) => it !== lostField.value()));
		}
	};
</script>

{#if card.type === "add" && gainedField}
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Add {title}</h4>
			<div class="flex gap-4">
				<Control class="flex-1">
					<Input field={gainedField.id} type="hidden" />
					<Input field={gainedField.name} type="text" label="Name" required />
				</Control>
				<button type="button" class="btn btn-error mt-10" onclick={(ev) => ondelete(ev)} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<Control>
				<MarkdownInput field={gainedField.description} maxRows={8} maxLength={2000} preview />
			</Control>
		</div>
	</div>
{:else if card.type === "drop" && lostField}
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Drop {title}</h4>
			<div class="flex gap-4">
				<Control class="flex-1">
					<InputWrapper field={lostField} as="select" label="Select an Item">
						<select {...lostField.as("select")} id={lostField.as("select").name} class="select select-bordered w-full">
							{#each card.items.filter((item) => item.id === lostField.value() || !arrValue.includes(item.id)) as item (item.id)}
								<option value={item.id}>
									{item.name}
								</option>
							{/each}
						</select>
					</InputWrapper>
				</Control>
				<button type="button" class="btn btn-error mt-10" onclick={(ev) => ondelete(ev)} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<div class="text-sm">
				{card.items.find((item) => lostField.value() === item.id)?.description || ""}
			</div>
		</div>
	</div>
{/if}
