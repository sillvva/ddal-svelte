import { twMerge } from "tailwind-merge";

export const stopWords = new Set(["and", "or", "to", "in", "a", "the", "of"]);

export const parseError = (e: unknown) => {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	if (typeof e === "object") return JSON.stringify(e);
	return "Unknown error";
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
		text.trim() && "tooltip"
	);
};

export const sorter = (a: string | number | Date, b: string | number | Date) => {
	if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
	return 0;
};

export const transition = (action: ViewTransitionCallback) => {
	if (!document.startViewTransition) {
		action();
		return;
	}
	return document.startViewTransition(action);
};
