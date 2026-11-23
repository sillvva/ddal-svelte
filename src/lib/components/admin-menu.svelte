<script lang="ts">
	import { page } from "$app/state";
	import type { Snippet } from "svelte";
	import type { ClassValue } from "svelte/elements";
	import Link from "./link.svelte";

	interface Props {
		/** Unique id used for the popover and its anchor. */
		id: string;
		/** Classes applied to the trigger button. */
		class?: ClassValue;
		/** Placement of the menu relative to the trigger. */
		placement?: "bottom" | "top";
		children: Snippet;
	}

	let { id, class: className, placement = "bottom", children }: Props = $props();

	const items = [
		{ title: "Users", href: "admin/users", path: "/admin/users" },
		{ title: "Logs", href: "admin/logs", path: "/admin/logs" },
		{ title: "Storage", href: "admin/storage", path: "/admin/storage" }
	] as const;

	function close() {
		document.getElementById(id)?.hidePopover();
	}
</script>

<button type="button" class={className} aria-label="Admin" aria-haspopup="menu" popovertarget={id} style:anchor-name="--{id}">
	{@render children()}
</button>
<ul
	role="menu"
	class={[
		"menu dropdown z-30 w-40 rounded-box bg-base-300 shadow-sm",
		placement === "bottom" ? "dropdown-end dropdown-bottom" : "dropdown-center dropdown-top"
	]}
	popover
	{id}
	style:position-anchor="--{id}"
>
	{#each items as item (item.href)}
		<li role="menuitem">
			<Link href={item.href} class={[page.url.pathname.startsWith(item.path) && "menu-active"]} onclick={close}>
				{item.title}
			</Link>
		</li>
	{/each}
</ul>
