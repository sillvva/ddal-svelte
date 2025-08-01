<script lang="ts">
	import { goto } from "$app/navigation";
	import { errorToast, successToast } from "$lib/factories.svelte";
	import type { CharacterId } from "$lib/schemas";
	import type { Character } from "$lib/server/db/schema";
	import { getGlobal } from "$lib/stores.svelte";
	import { superForm } from "sveltekit-superforms";

	const global = getGlobal();

	interface Props {
		character: Character;
		label?: string;
		ondelete?: (event: { id: CharacterId }) => void;
	}

	let { character, label = "", ondelete }: Props = $props();

	const { submit } = superForm(
		{ id: character.id },
		{
			SPA: `/characters/${character.id}?/deleteCharacter`,
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${character.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", character.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors._errors || [];
				if (error) {
					errorToast(error);
				} else {
					successToast(`${character.name} deleted`);
					ondelete?.({ id: character.id });
					global.searchData = [];
				}
			},
			onResult({ result }) {
				if (result.type === "redirect") {
					successToast(`${character.name} deleted`);
					ondelete?.({ id: character.id });
					global.searchData = [];
					goto(result.location);
				}
			}
		}
	);
</script>

<button type="button" class="hover:bg-error" aria-label="Delete Character" onclick={submit}>
	{label}
</button>
