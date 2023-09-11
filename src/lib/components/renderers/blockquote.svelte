<script lang="ts">
	import { onMount } from "svelte";

	let el: HTMLDetailsElement | null = null;

	onMount(() => {
		if (el) {
			const iHTML = el.innerHTML.trim();
			const matches = iHTML.match(/\<(h\d)/);
			const match = (matches && matches[1]) || null;
			if (match && iHTML.startsWith("<" + match)) {
				const header = el.querySelector(match);
				if (header) el.innerHTML = iHTML.replace(/\<h\d/, "<summary").replace(/\<\/h\d/, "</summary");
			}
		}
	});
</script>

<details bind:this={el}><slot /></details>
