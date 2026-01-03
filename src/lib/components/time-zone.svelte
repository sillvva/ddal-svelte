<script lang="ts">
	import { getGlobal } from "$lib/stores.svelte";
	import { getLocalTimeZone } from "@internationalized/date";
	import { Combobox } from "bits-ui";

	const global = getGlobal();

	const timeZoneStrings = Intl.supportedValuesOf("timeZone");
	const timeZones = $derived(
		timeZoneStrings.map((tz) => ({
			value: tz,
			label: tz
		}))
	);

	let defaultValue = $state.snapshot(global.app.settings.timezone);
	let searchValue = $derived(global.app.settings.timezone);
	let filteredTimeZones = $derived(timeZones.filter((tz) => tz.label.toLowerCase().includes(searchValue.toLowerCase())));

	$effect(() => {
		if (!global.app.settings.timezone) {
			global.app.settings.timezone = getLocalTimeZone();
		}
	});
</script>

<Combobox.Root name="timezone" type="single" items={timeZones} bind:value={global.app.settings.timezone}>
	<div class="dropdown dropdown-end">
		<Combobox.Input class="input input-bordered input-sm text-xs!" aria-label="Search a time zone" {defaultValue}>
			{#snippet child({ props })}
				<input {...props} bind:value={searchValue} />
			{/snippet}
		</Combobox.Input>
		<Combobox.Trigger class="absolute end-2 top-1/2 size-6 -translate-y-1/2 touch-none">
			<span class="iconify mdi--chevron-down size-4"></span>
		</Combobox.Trigger>
		<Combobox.ContentStatic class="menu dropdown-content bg-base-200 z-10 max-h-96 rounded-lg p-2 shadow-sm">
			{#snippet child({ props })}
				<ul {...props}>
					<Combobox.Viewport>
						{#each filteredTimeZones as timeZone (timeZone.value)}
							<Combobox.Item
								class={[
									"hover:bg-base-content/25 rounded-lg px-3 py-1",
									"data-highlighted:bg-base-content/25",
									"data-selected:bg-primary data-selected:text-primary-content data-selected:font-bold"
								].join(" ")}
								value={timeZone.value}
								label={timeZone.label}
							>
								{timeZone.label}
								{#if timeZone.value === getLocalTimeZone()}
									<span class="text-base-content/50 font-normal">(Local)</span>
								{/if}
							</Combobox.Item>
						{:else}
							<span class="block px-5 py-2 text-sm"> No results found, try again. </span>
						{/each}
					</Combobox.Viewport>
				</ul>
			{/snippet}
		</Combobox.ContentStatic>
	</div>
</Combobox.Root>
