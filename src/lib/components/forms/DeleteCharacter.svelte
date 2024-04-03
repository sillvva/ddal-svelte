<script lang="ts">
	import { errorToast, successToast } from "$lib/factories";
	import { searchData } from "$lib/stores";
	import type { Character } from "$server/db/schema";
	import { createEventDispatcher } from "svelte";
	import { superForm } from "sveltekit-superforms";

	export let character: Character;
	export let label = "";

	const dispatch = createEventDispatcher<{
		deleted: { id: string };
	}>();

	const { submit } = superForm(
		{ id: character.id },
		{
			SPA: "?/deleteCharacter",
			onSubmit({ cancel, formData }) {
				if (!confirm(`Are you sure you want to delete ${character.name}? This action cannot be reversed.`)) return cancel();
				formData.set("id", character.id);
			},
			onUpdated({ form }) {
				const [error] = form.errors.id || [];
				if (error) {
					errorToast(error);
				} else {
					successToast(`${character.name} deleted`);
					dispatch("deleted", { id: character.id });
					$searchData = [];
				}
			}
		}
	);
</script>

<button type="button" class="menu-item-error" aria-label="Delete Character" on:click={submit}>
	{label}
</button>
