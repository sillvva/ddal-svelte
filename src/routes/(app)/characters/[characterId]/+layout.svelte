<script lang="ts">
	import { setBreadcrumb } from "$lib/stores.svelte";

	let { data, children } = $props();

	setBreadcrumb({ url: `/characters/${data.character?.id}`, title: data.character?.name });
</script>

{@render children()}
