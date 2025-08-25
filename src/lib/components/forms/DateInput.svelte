<script lang="ts">
	import { dateToDV, intDateProxy } from "$lib/factories.svelte";
	import { DatePicker, type DatePickerRootProps } from "bits-ui";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";

	type TForm = $$Generic<Record<PropertyKey, unknown>>;
	type TMin = $$Generic<Date | undefined>;
	type TMax = $$Generic<Date | undefined>;
	interface Props extends DatePickerRootProps {
		superform: SuperForm<TForm>;
		field: FormPathLeaves<TForm, Date>;
		label: string;
		minDate?: TMin;
		minDateField?: TMin extends Date ? never : FormPathLeaves<TForm, Date>;
		maxDate?: TMax;
		maxDateField?: TMax extends Date ? never : FormPathLeaves<TForm, Date>;
		empty?: "null" | "undefined";
		required?: boolean;
		description?: string;
		class?: string;
	}

	let {
		superform,
		field,
		label,
		minDate,
		minDateField,
		maxDate,
		maxDateField,
		empty = "null",
		required,
		description,
		class: inputClass = "",
		...rest
	}: Props = $props();

	const { errors, constraints } = formFieldProxy(superform, field);

	const proxyValue = $derived(intDateProxy(superform, field, { empty }));
	const proxyMin = $derived(minDateField && intDateProxy(superform, minDateField));
	const proxyMax = $derived(maxDateField && intDateProxy(superform, maxDateField));

	const minDateValue = $derived(dateToDV(minDate));
	const maxDateValue = $derived(dateToDV(maxDate));
	const minProxyValue = $derived(proxyMin && $proxyMin);
	const maxProxyValue = $derived(proxyMax && $proxyMax);
	const minValue = $derived(rest?.minValue || minDateValue || minProxyValue);
	const maxValue = $derived(rest?.maxValue || maxDateValue || maxProxyValue);

	$effect(() => {
		if ($proxyValue && minValue && $proxyValue.compare(minValue) < 0) $proxyValue = minValue;
	});
	$effect(() => {
		if ($proxyValue && maxValue && $proxyValue.compare(maxValue) > 0) $proxyValue = maxValue;
	});
</script>

<DatePicker.Root
	granularity="minute"
	{...rest}
	bind:value={$proxyValue}
	minValue={minValue?.set({ hour: 0, minute: 0, second: 0 })}
	maxValue={maxValue?.set({ hour: 23, minute: 59, second: 59 })}
>
	<DatePicker.Label class="fieldset-legend">
		<span>
			{label}
			{#if $constraints?.required || required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</DatePicker.Label>
	<DatePicker.Input class={twMerge("input inline-flex w-full items-center gap-1 px-3 select-none", inputClass)}>
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
{#if $errors?.length || description}
	<label for={field} class="fieldset-label">
		{#if $errors?.length}
			<span class="text-error">{$errors[0]}</span>
		{:else}
			<span class="text-neutral-500">{description}</span>
		{/if}
	</label>
{/if}
