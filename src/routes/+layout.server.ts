export const load = async (event) => {
	return {
		session: await event.locals.getSession(),
		breadcrumbs: [] as { name: string; href?: string }[],
	};
};
