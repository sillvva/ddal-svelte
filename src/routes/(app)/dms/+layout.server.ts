export const load = async (event) => {
	const parent = await event.parent();

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: "DMs",
			href: "/dms"
		})
	};
};
