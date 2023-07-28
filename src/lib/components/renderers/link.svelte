<script lang="ts">
	export let href = "";
	export let title: string | null | undefined = undefined;
</script>

<a {href} {title} class="text-secondary"><slot /></a>
