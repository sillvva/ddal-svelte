<script lang="ts">
	import { setBreadcrumb } from "$lib/stores.svelte";

	let { children } = $props();

	setBreadcrumb({ url: "/dm-logs", title: "DM Logs" });
</script>

{@render children()}
