<script lang="ts">
	import { dateToDV, intDateProxy } from "$lib/factories";
	import { DatePicker, type DatePickerProps } from "bits-ui";
	import { formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";

	type TForm = $$Generic<Record<PropertyKey, unknown>>;
	type TMin = $$Generic<Date | undefined>;
	type TMax = $$Generic<Date | undefined>;
	interface $$Props extends DatePickerProps {
		superform: SuperForm<TForm, any>;
		field: FormPathLeaves<TForm, Date>;
		minDate?: TMin;
		minDateField?: TMin extends Date ? never : FormPathLeaves<TForm, Date>;
		maxDate?: TMax;
		maxDateField?: TMax extends Date ? never : FormPathLeaves<TForm, Date>;
		empty?: "null" | "undefined";
		required?: boolean;
		description?: string;
		class?: string;
	}

	export let superform: SuperForm<TForm, any>;
	export let field: FormPathLeaves<TForm, Date>;
	export let minDate: Date | undefined = undefined;
	export let minDateField: FormPathLeaves<TForm, Date> | undefined = undefined;
	export let maxDate: Date | undefined = undefined;
	export let maxDateField: FormPathLeaves<TForm, Date> | undefined = undefined;
	export let empty: "null" | "undefined" = "null";
	export let required: boolean | undefined = undefined;
	export let description = "";

	let inputClass = "";
	export { inputClass as class };

	$: rest = $$restProps as DatePickerProps;

	const { errors, constraints } = formFieldProxy(superform, field);

	$: proxyValue = intDateProxy(superform, field, { empty });
	$: proxyMin = minDateField && intDateProxy(superform, minDateField);
	$: proxyMax = maxDateField && intDateProxy(superform, maxDateField);

	$: minDateValue = minDate && dateToDV(minDate);
	$: maxDateValue = maxDate && dateToDV(maxDate);
	$: minProxyValue = proxyMin && $proxyMin;
	$: maxProxyValue = proxyMax && $proxyMax;
	$: minValue = rest?.minValue || minDateValue || minProxyValue;
	$: maxValue = rest?.maxValue || maxDateValue || maxProxyValue;

	$: if ($proxyValue && minValue && $proxyValue.compare(minValue) < 0) $proxyValue = minValue;
	$: if ($proxyValue && maxValue && $proxyValue.compare(maxValue) > 0) $proxyValue = maxValue;
</script>

<DatePicker.Root
	granularity="minute"
	portal={null}
	{...rest}
	bind:value={$proxyValue}
	minValue={minValue?.set({ hour: 0, minute: 0, second: 0 })}
	maxValue={maxValue?.set({ hour: 23, minute: 59, second: 59 })}
>
	<DatePicker.Label class="label">
		<span class="label-text">
			<slot />
			{#if $constraints?.required || required}
				<span class="text-error">*</span>
			{/if}
		</span>
	</DatePicker.Label>
	<DatePicker.Input
		let:segments
		class={twMerge("input input-bordered inline-flex w-full select-none items-center gap-1 px-3", inputClass)}
	>
		{#each segments as { part, value }}
			<DatePicker.Segment
				{part}
				class="rounded-sm py-1 outline-offset-4 focus-visible:outline-primary aria-[valuetext=Empty]:text-base-content/70"
			>
				{value}
			</DatePicker.Segment>
		{/each}
		<DatePicker.Trigger class="ml-auto inline-flex items-center justify-center">
			<span class="iconify size-6 mdi--calendar" />
		</DatePicker.Trigger>
	</DatePicker.Input>
	<DatePicker.Content class="z-[10000] mt-2">
		<DatePicker.Calendar let:months let:weekdays class="shadow-popover rounded-lg border border-base-300 bg-base-200 p-[22px]">
			<DatePicker.Header class="flex items-center justify-between">
				<DatePicker.PrevButton class="iconify inline-flex size-10 items-center justify-center transition-all mdi--chevron-left" />
				<DatePicker.Heading class="text-lg" />
				<DatePicker.NextButton
					class="iconify inline-flex size-10 items-center justify-center transition-all mdi--chevron-right"
				/>
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
												class={[
													"rounded-9px group relative inline-flex size-10 items-center justify-center whitespace-nowrap",
													"border border-transparent bg-transparent p-0 text-sm font-normal transition-all",
													"hover:border-base-content/50 data-[outside-month]:pointer-events-none",
													"data-[disabled]:pointer-events-none data-[disabled]:text-base-content/30",
													"data-[selected]:bg-base-300 data-[selected]:font-medium",
													"data-[unavailable]:text-base-content/30 data-[unavailable]:line-through"
												].join(" ")}
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
