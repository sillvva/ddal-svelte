<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children?: Snippet;
		attributes?: Record<string, unknown>;
	}

	const { children, attributes }: Props = $props();
</script>

<summary
	{...attributes}
	class={[
		"my-0 cursor-pointer text-xl font-semibold *:my-0 *:inline-block *:py-0",
		"has-[h3]:marker:text-3xl has-[h4]:marker:text-2xl has-[h5]:marker:text-xl has-[h6]:marker:text-lg"
	]}
>
	{@render children?.()}
</summary>

<style>
	summary {
		margin-bottom: 0;
	}
	:global(details[open]) summary {
		margin-bottom: 4px;
	}
</style>
