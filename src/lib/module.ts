export const routeModules = import.meta.glob("/src/routes/**/+page.svelte", {
	eager: true
}) as Record<string, App.ModuleData>;
