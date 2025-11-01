<script lang="ts">
	import * as API from "$lib/remote";
	import { setBreadcrumb } from "$lib/stores.svelte";

	let { children, params } = $props();

	const character = $derived(await API.characters.queries.get({ param: params.characterId, newRedirect: true }));
	$effect(() => {
		setBreadcrumb({ url: `/characters/${character.id}`, title: character.name });
	});
</script>

{@render children()}
