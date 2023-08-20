export const load = async (event) => {
	const parent = await event.parent();

	return {
		breadcrumbs: parent.breadcrumbs.concat({
			name: "DM Logs",
			href: "/dm-logs"
		})
	};
};
