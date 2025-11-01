<script lang="ts">
	import type { ItemSchema, ItemSchemaIn, LogSchemaIn } from "$lib/schemas";
	import type { RemoteFormField, RemoteFormFields } from "@sveltejs/kit";
	import Control from "./control.svelte";
	import RemoteGenericInput from "./remote-generic-input.svelte";
	import RemoteInput from "./remote-input.svelte";
	import RemoteMdInput from "./remote-md-input.svelte";

	type RequiredFields = "magicItemsGained" | "magicItemsLost" | "storyAwardsGained" | "storyAwardsLost";

	interface BaseProps {
		entity: "magicItems" | "storyAwards";
		log: Omit<LogSchemaIn, "dm"> & Required<Pick<LogSchemaIn, RequiredFields>>;
	}

	interface AddProps extends BaseProps {
		type: "add";
		field: RemoteFormFields<ItemSchemaIn>;
	}

	interface DropProps extends BaseProps {
		type: "drop";
		field: RemoteFormField<string>;
		items: ItemSchema[];
	}

	type Props = AddProps | DropProps;

	let { entity, log = $bindable(), ...card }: Props = $props();

	const title = entity === "magicItems" ? "Magic Item" : "Story Award";

	const arrValue = $derived(card.type === "drop" ? (entity === "magicItems" ? log.magicItemsLost : log.storyAwardsLost) : []);

	const ondelete = (ev: Event) => {
		ev.preventDefault();
		if (card.type === "add") {
			if (entity === "magicItems") log.magicItemsGained = log.magicItemsGained.filter((it) => it.id !== card.field.id.value());
			else log.storyAwardsGained = log.storyAwardsGained.filter((it) => it.id !== card.field.id.value());
		}
		if (card.type === "drop") {
			if (entity === "magicItems") log.magicItemsLost = log.magicItemsLost.filter((it) => it !== card.field.value());
			else log.storyAwardsLost = log.storyAwardsLost.filter((it) => it !== card.field.value());
		}
	};
</script>

{#if card.type === "add"}
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Add {title}</h4>
			<div class="flex gap-4">
				<Control class="flex-1">
					<RemoteInput field={card.field.id} type="hidden" />
					<RemoteInput field={card.field.name} type="text" label="Name" required />
				</Control>
				<button type="button" class="btn btn-error mt-10" onclick={(ev) => ondelete(ev)} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<Control>
				<RemoteMdInput field={card.field.description} maxRows={8} maxLength={2000} preview />
			</Control>
		</div>
	</div>
{:else if card.type === "drop"}
	<div class="card bg-base-300/70 col-span-12 shadow-xl sm:col-span-6">
		<div class="card-body flex flex-col">
			<h4 class="text-xl">Drop {title}</h4>
			<div class="flex gap-4">
				<Control class="flex-1">
					<RemoteGenericInput field={card.field} as="select" label="Select an Item">
						<select {...card.field.as("select")} id={card.field.as("select").name} class="select select-bordered w-full">
							{#each card.items.filter((item) => item.id === card.field.value() || !arrValue.includes(item.id)) as item (item.id)}
								<option value={item.id}>
									{item.name}
								</option>
							{/each}
						</select>
					</RemoteGenericInput>
				</Control>
				<button type="button" class="btn btn-error mt-10" onclick={(ev) => ondelete(ev)} aria-label="Delete Entry">
					<span class="iconify mdi--trash-can size-6"></span>
				</button>
			</div>
			<div class="text-sm">
				{card.items.find((item) => card.field.value() === item.id)?.description || ""}
			</div>
		</div>
	</div>
{/if}
