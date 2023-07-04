import dayjs from "dayjs";
import { twMerge } from "tailwind-merge";

export const stopWords = new Set(["and", "or", "to", "in", "a", "the", "of"]);

export const parseError = (e: unknown) => {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (typeof e === "object") return JSON.stringify(e);
	return "Unknown error";
};

export const formatDate = (date: Date | string) => {
	return dayjs(date).format("YYYY-MM-DDTHH:mm");
};

export const slugify = (text: string) => {
	return text
		.toString()
		.normalize("NFD") // split an accented letter in the base letter and the acent
		.replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^\w-]+/g, "")
		.replace(/--+/g, "-");
};

export const tooltipClasses = (text?: string | null, align = "center") => {
	if (!text) return "";
	return twMerge(
		"before:hidden before:lg:block before:max-h-[50vh] before:overflow-hidden before:text-ellipsis",
		"before:z-20 before:whitespace-normal before:![content:attr(data-tip)]",
		align == "left" && "before:left-0 before:translate-x-0",
		align == "right" && "before:right-0 before:translate-x-0",
		text?.trim() && "tooltip"
	);
};

export function canUseDOM() {
	return !!(typeof window !== "undefined" && window.document && window.document.createElement);
}

export function sorter(a: string | number | Date, b: string | number | Date) {
	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}
