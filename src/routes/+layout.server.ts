export const load = async (event) => {
	return {
		session: await event.locals.getSession(),
		breadcrumbs: [] as { name: string; href?: string }[],
		mobile: !!event.request.headers
			.get("user-agent")
			?.match(
				/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
			)
	};
};
