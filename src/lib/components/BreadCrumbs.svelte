<script>
	import Icon from "./Icon.svelte";
</script>

<div class="breadcrumbs mb-4 hidden flex-1 text-sm sm:flex">
	<ul>
		<li>
			<Icon src="home" class="w-4" />
		</li>
		<slot />
	</ul>
</div>
