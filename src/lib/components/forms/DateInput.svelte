<script lang="ts" context="module">
	type TRec = Record<string, unknown>;
</script>

<script lang="ts" generics="TForm extends TRec, TMin extends Date | undefined, TMax extends Date | undefined">
	import { parseDateTime } from "@internationalized/date";
	import { DatePicker, type DatePickerProps } from "bits-ui";
	import { dateProxy, formFieldProxy, type FormPathLeaves, type SuperForm } from "sveltekit-superforms";
	import { twMerge } from "tailwind-merge";

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

	function dateToLocalISO(date: Date) {
		return date
			.toLocaleDateString("sv", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			})
			.replace(" ", "T");
	}

	const { errors, constraints } = formFieldProxy(superform, field);

	$: proxyDate = dateProxy(superform, field, { format: "datetime-local", empty });
	$: proxyMin = minDateField && dateProxy(superform, minDateField, { format: "datetime-local" });
	$: proxyMax = maxDateField && dateProxy(superform, maxDateField, { format: "datetime-local" });

	$: rest = $$restProps as DatePickerProps;

	$: value = rest?.value || ($proxyDate ? parseDateTime($proxyDate) : undefined);
	$: minDateValue = minDate && parseDateTime(dateToLocalISO(minDate));
	$: maxDateValue = maxDate && parseDateTime(dateToLocalISO(maxDate));
	$: minProxyValue = proxyMin && $proxyMin && parseDateTime($proxyMin);
	$: maxProxyValue = proxyMax && $proxyMax && parseDateTime($proxyMax);
	$: minValue = rest?.minValue || minDateValue || minProxyValue;
	$: maxValue = rest?.maxValue || maxDateValue || maxProxyValue;

	$: if (value && minValue && value.compare(minValue) < 0) value = minValue;
	$: if (value && maxValue && value.compare(maxValue) > 0) value = maxValue;
</script>

<DatePicker.Root
	granularity="minute"
	portal={null}
	{...rest}
	bind:value
	minValue={minValue?.set({ hour: 0, minute: 0, second: 0 })}
	maxValue={maxValue?.set({ hour: 23, minute: 59, second: 59 })}
	onValueChange={(date) => {
		if (date && minValue && date.compare(minValue) < 0) date = minValue;
		if (date && maxValue && date.compare(maxValue) > 0) date = maxValue;
		proxyDate.set(date?.toString() ?? "");
		rest.onValueChange?.(date);
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
	<DatePicker.Input
		let:segments
		class="input input-bordered inline-flex w-full select-none items-center gap-1 px-3 signal/date-xs:text-xs"
	>
		{#each segments as { part, value }}
			<DatePicker.Segment
				{part}
				class={twMerge(
					"rounded-sm py-1 outline-offset-4 focus-visible:outline-primary aria-[valuetext=Empty]:text-base-content/70",
					part === "dayPeriod" && "aria-[valuenow=PM]:signal aria-[valuenow=PM]:before:[content:attr(aria-valuenow)]"
				)}
			>
				<span class="signal:hidden">{value}</span>
			</DatePicker.Segment>
		{/each}
		<DatePicker.Trigger class="ml-auto inline-flex items-center justify-center">
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
												class={twMerge(
													"rounded-9px group relative inline-flex size-10 items-center justify-center whitespace-nowrap",
													"border border-transparent bg-transparent p-0 text-sm font-normal transition-all",
													"hover:border-base-content/50 data-[outside-month]:pointer-events-none",
													"data-[disabled]:pointer-events-none data-[disabled]:text-base-content/30",
													"data-[selected]:bg-base-300 data-[selected]:font-medium",
													"data-[unavailable]:text-base-content/30 data-[unavailable]:line-through"
												)}
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
