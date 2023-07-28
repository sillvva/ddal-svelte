import type { Action } from "svelte/action";

export const lazy: Action<HTMLImageElement, IntersectionObserverInit | undefined> = (node, params) => {
	const observer = new IntersectionObserver((entries) => {
		if (!entries[0].isIntersecting) return;
		if (node.dataset.src) node.src = node.dataset.src;
		observer.unobserve(node);
	}, params);

	observer.observe(node);

	return {
		destroy() {
			observer.unobserve(node);
		}
	};
};
