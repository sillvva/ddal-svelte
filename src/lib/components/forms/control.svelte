<script lang="ts">
	import type { Snippet } from "svelte";
	import type { ClassValue, HTMLAttributes } from "svelte/elements";

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class"> {
		children?: Snippet;
		class?: ClassValue;
	}

	let { class: className = "", children, ...rest }: Props = $props();
</script>

<div class={["fieldset has-[.checkbox]:auto-rows-auto", className]} {...rest}>
	{@render children?.()}
</div>
