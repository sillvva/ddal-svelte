<script lang="ts">
	import { setBreadcrumb } from "$lib/stores.svelte";

	let { children } = $props();

	setBreadcrumb({ url: "/dms", title: "DMs" });
</script>

{@render children()}
