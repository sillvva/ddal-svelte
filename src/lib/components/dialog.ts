import type { Attachment } from "svelte/attachments";

/**
 * Opens a `<dialog>` with `showModal()` so it renders in the top layer.
 * Dialogs inside table rows or swipe rows would otherwise be clipped by transforms and stacking contexts.
 * `onclose` runs for Escape, `<form method="dialog">` buttons, and `dialog.close()`.
 */
export function topLayerDialog(onclose: () => void): Attachment<HTMLDialogElement> {
	return (dialog) => {
		dialog.addEventListener("close", onclose);
		if (!dialog.open) dialog.showModal();
		return () => {
			dialog.removeEventListener("close", onclose);
			if (dialog.open) dialog.close();
		};
	};
}
