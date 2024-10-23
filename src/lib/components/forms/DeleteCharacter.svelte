<script lang="ts">
	import { errorToast, successToast } from "$lib/factories.svelte";
	import { global } from "$lib/stores.svelte";
	import type { Character } from "$server/db/schema";
	import { superForm } from "sveltekit-superforms";

	interface Props {
		character: Character;
		label?: string;
		ondelete?: (event: { id: string }) => void;
	}

	let { character, label = "", ondelete }: Props = $props();

	const { submit } = superForm(
		{ id: character.id },
		{
			SPA: "?/deleteCharacter",
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
			}
		}
	);
</script>

<button type="button" class="menu-item-error" aria-label="Delete Character" onclick={submit}>
	{label}
</button>
