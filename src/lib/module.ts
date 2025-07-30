export const routeModules = import.meta.glob("/src/routes/**/+page.svelte", {
	eager: true
}) satisfies Record<string, App.ModuleData>;
