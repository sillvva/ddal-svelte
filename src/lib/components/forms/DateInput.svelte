<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="T extends TRec">
	import { parseDateTime } from "@internationalized/date";
	import { DatePicker } from "bits-ui";
	import type { HTMLInputAttributes } from "svelte/elements";
	import { writable } from "svelte/store";
	import { dateProxy, formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";

	interface $$Props extends HTMLInputAttributes {
		superform: SuperForm<T, any>;
		field: FormPathLeaves<T, Date>;
		empty?: "null" | "undefined";
		minDate?: Date;
		maxDate?: Date;
		readonly?: boolean;
		required?: boolean;
		description?: string;
	}

	export let superform: SuperForm<T, any>;
	export let field: FormPathLeaves<T, Date>;
	export let empty: "null" | "undefined" = "null";
	export let minDate: Date | undefined = undefined;
	export let maxDate: Date | undefined = undefined;
	export let readonly: boolean | undefined = undefined;
	export let required = false;
	export let description = "";

	function dateToISOButLocal(date?: Date) {
		if (!date) return "";
		const offsetMs = date.getTimezoneOffset() * 60 * 1000;
		const msLocal = date.getTime() - offsetMs;
		const dateLocal = new Date(msLocal);
		const iso = dateLocal.toISOString();
		const isoLocal = iso.slice(0, 19);
		return isoLocal;
	}

	const { errors, constraints } = formFieldProxy(superform, field);

	$: proxyDate = dateProxy(superform, field, { format: "datetime-local", empty });
	$: value = $proxyDate ? parseDateTime($proxyDate) : undefined;

	$: proxyMin = writable(dateToISOButLocal(minDate));
	$: proxyMax = writable(dateToISOButLocal(maxDate));
	$: minValue = proxyMin && $proxyMin ? parseDateTime($proxyMin) : undefined;
	$: maxValue = proxyMax && $proxyMax ? parseDateTime($proxyMax) : undefined;

	$: if (value && minValue && value.toString() < minValue.toString()) value = minValue;
	$: if (value && maxValue && value.toString() > maxValue.toString()) value = maxValue;
</script>

<DatePicker.Root
	granularity="minute"
	bind:value
	minValue={minValue?.subtract({ days: 1 })}
	{maxValue}
	portal={null}
	disabled={readonly}
	onValueChange={(date) => {
		if (date && minValue && date.toString() < minValue.toString()) date = minValue;
		if (date && maxValue && date.toString() > maxValue.toString()) date = maxValue;
		proxyDate.set(date?.toString() ?? "");
	}}
>
	<DatePicker.Label class="label">
		<span class="label-text">
			<slot />
			{#if $constraints?.required || required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</DatePicker.Label>
	<DatePicker.Input let:segments class="input input-bordered inline-flex w-full px-2 py-[7px]">
		{#each segments as { part, value }}
			<div class="inline-block select-none">
				<DatePicker.Segment
					{part}
					class="rounded-md p-1 focus-visible:outline-primary aria-[valuetext=Empty]:text-base-content/70 aria-[valuenow=PM]:signal aria-[valuenow=PM]:before:[content:attr(aria-valuenow)] data-[segment=literal]:px-0 lg:py-2 lg:text-xs"
				>
					<span class="signal:hidden">{value}</span>
				</DatePicker.Segment>
			</div>
		{/each}
		<DatePicker.Trigger class="ml-auto inline-flex size-8 items-center justify-center">
			<span class="iconify size-6 mdi-calendar" />
		</DatePicker.Trigger>
	</DatePicker.Input>
	<DatePicker.Content class="z-[10000] mt-2">
		<DatePicker.Calendar let:months let:weekdays class="shadow-popover rounded-lg border border-base-300 bg-base-200 p-[22px]">
			<DatePicker.Header class="flex items-center justify-between">
				<DatePicker.PrevButton class="iconify inline-flex size-10 items-center justify-center transition-all mdi-chevron-left" />
				<DatePicker.Heading class="text-lg" />
				<DatePicker.NextButton class="iconify inline-flex size-10 items-center justify-center transition-all mdi-chevron-right" />
			</DatePicker.Header>
			<div class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0">
				{#each months as month}
					<DatePicker.Grid class="w-full border-collapse select-none space-y-1">
						<DatePicker.GridHead>
							<DatePicker.GridRow class="mb-1 flex w-full justify-between">
								{#each weekdays as day}
									<DatePicker.HeadCell class="w-10 rounded-md text-xs !font-normal text-base-content/50">
										<div>{day.slice(0, 2)}</div>
									</DatePicker.HeadCell>
								{/each}
							</DatePicker.GridRow>
						</DatePicker.GridHead>
						<DatePicker.GridBody>
							{#each month.weeks as weekDates}
								<DatePicker.GridRow class="flex w-full">
									{#each weekDates as date}
										<DatePicker.Cell {date} class="relative size-10 !p-0 text-center text-sm">
											<DatePicker.Day
												{date}
												month={month.value}
												class="rounded-9px group relative inline-flex size-10 items-center justify-center whitespace-nowrap border border-transparent bg-transparent p-0 text-sm font-normal transition-all hover:border-base-content/50 data-[disabled]:pointer-events-none data-[outside-month]:pointer-events-none data-[selected]:bg-base-300 data-[selected]:font-medium data-[disabled]:text-base-content/30 data-[unavailable]:text-base-content/30 data-[unavailable]:line-through"
											>
												<div
													class="absolute top-[5px] hidden size-1 rounded-full transition-all group-data-[today]:block group-data-[selected]:bg-base-content/50"
												/>
												{date.day}
											</DatePicker.Day>
										</DatePicker.Cell>
									{/each}
								</DatePicker.GridRow>
							{/each}
						</DatePicker.GridBody>
					</DatePicker.Grid>
				{/each}
			</div>
		</DatePicker.Calendar>
	</DatePicker.Content>
</DatePicker.Root>
{#if $errors?.length || description}
	<label for={field} class="label">
		{#if $errors?.length}
			<span class="label-text-alt text-error">{$errors[0]}</span>
		{:else}
			<span class="label-text-alt text-neutral-500">{description}</span>
		{/if}
	</label>
{/if}
