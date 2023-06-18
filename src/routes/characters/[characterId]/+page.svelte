<script lang="ts">
	import type { PageData } from "./$types";

	export let data: PageData;
	const character = data.character;
</script>

{JSON.stringify(character)}
