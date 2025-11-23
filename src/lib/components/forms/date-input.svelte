<script lang="ts">
	import { dateToCalendar } from "$lib/factories.svelte";
	import { getLocalTimeZone, type DateValue } from "@internationalized/date";
	import type { RemoteFormField } from "@sveltejs/kit";
	import { DatePicker, type DatePickerRootProps } from "bits-ui";
	import { isTupleOfAtLeast } from "effect/Predicate";
	import Input from "./input.svelte";

	interface Props extends Omit<DatePickerRootProps, "value" | "minValue" | "maxValue"> {
		field: RemoteFormField<number>;
		label: string;
		min?: number;
		max?: number;
		required?: boolean;
		description?: string;
	}

	let {
		field,
		label,
		min = new Date(2014, 0).getTime(),
		max = new Date().getTime(),
		required,
		description,
		...rest
	}: Props = $props();

	const issues = $derived(field.issues());
	const attributes = $derived(field.as("number"));
	const name = $derived("name" in attributes ? (attributes.name as string) : undefined);
	const minDateValue = $derived(dateToCalendar(min));
	const maxDateValue = $derived(dateToCalendar(max));

	function clamp(value: DateValue, min: DateValue, max: DateValue) {
		if (value.compare(min) < 0) return min;
		if (value.compare(max) > 0) return max;
		return value;
	}
</script>

<Input {field} type="number" hidden />
<DatePicker.Root
	granularity="minute"
	{...rest}
	bind:value={
		() => (field.value() ? clamp(dateToCalendar(field.value()), minDateValue, maxDateValue) : undefined),
		(val) => {
			if (val) {
				const newValue = clamp(val, minDateValue, maxDateValue);
				const date = newValue.toDate(getLocalTimeZone());
				field.set(date.getTime());
			} else {
				field.set(0);
			}
		}
	}
	minValue={minDateValue.set({ hour: 0, minute: 0, second: 0 })}
	maxValue={maxDateValue.set({ hour: 23, minute: 59, second: 59 })}
>
	<DatePicker.Label class="fieldset-legend">
		<span>
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</DatePicker.Label>
	<DatePicker.Input class="input inline-flex w-full items-center gap-1 px-3 select-none sm:max-md:text-xs">
		{#snippet children({ segments })}
			{#each segments as { part, value }, i (i)}
				<DatePicker.Segment
					{part}
					class="focus-visible:outline-primary aria-[valuetext=Empty]:text-base-content/70 rounded-xs py-1 outline-offset-4"
				>
					{value}
				</DatePicker.Segment>
			{/each}
			<DatePicker.Trigger class="ml-auto inline-flex items-center justify-center">
				<span class="iconify mdi--calendar size-6"></span>
			</DatePicker.Trigger>
		{/snippet}
	</DatePicker.Input>
	<DatePicker.Content class="z-10000 mt-2">
		<DatePicker.Calendar class="shadow-popover border-base-300 bg-base-200 rounded-lg border p-[22px]">
			{#snippet children({ months, weekdays })}
				<DatePicker.Header class="flex items-center justify-between">
					<DatePicker.PrevButton
						class="iconify mdi--chevron-left inline-flex size-10 items-center justify-center transition-all"
					/>
					<DatePicker.Heading class="text-lg" />
					<DatePicker.NextButton
						class="iconify mdi--chevron-right inline-flex size-10 items-center justify-center transition-all"
					/>
				</DatePicker.Header>
				<div class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-y-0 sm:space-x-4">
					{#each months as month (month.value)}
						<DatePicker.Grid class="w-full border-collapse space-y-1 select-none">
							<DatePicker.GridHead>
								<DatePicker.GridRow class="mb-1 flex w-full justify-between">
									{#each weekdays as day, i (i)}
										<DatePicker.HeadCell class="text-base-content/50 w-10 rounded-md text-xs font-normal!">
											<div>{day.slice(0, 2)}</div>
										</DatePicker.HeadCell>
									{/each}
								</DatePicker.GridRow>
							</DatePicker.GridHead>
							<DatePicker.GridBody>
								{#each month.weeks as weekDates, i (i)}
									<DatePicker.GridRow class="flex w-full">
										{#each weekDates as date, j (j)}
											<DatePicker.Cell {date} month={month.value} class="relative size-10 p-0! text-center text-sm">
												<DatePicker.Day
													class={[
														"rounded-9px group relative inline-flex size-10 items-center justify-center whitespace-nowrap",
														"border border-transparent bg-transparent p-0 text-sm font-normal transition-all",
														"hover:border-base-content/50 data-outside-month:pointer-events-none",
														"data-disabled:text-base-content/30 data-disabled:pointer-events-none",
														"data-selected:bg-base-300 data-selected:font-medium",
														"data-unavailable:text-base-content/30 data-unavailable:line-through"
													].join(" ")}
												>
													<div
														class="group-data-selected:bg-base-content/50 absolute top-[5px] size-1 rounded-full transition-all not-group-data-today:hidden"
													></div>
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
			{/snippet}
		</DatePicker.Calendar>
	</DatePicker.Content>
</DatePicker.Root>
{#if issues || description}
	<label for={name} class="fieldset-label">
		{#if issues && isTupleOfAtLeast(issues, 1)}
			<span class="text-error">{issues[0]}</span>
		{:else}
			<span class="text-neutral-500">{description}</span>
		{/if}
	</label>
{/if}
