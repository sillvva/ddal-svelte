import { findNoteImageUrls } from "#lib/images/note-images.js";
import type { DungeonMasterId, ItemId, LogDraftData, UserId } from "#lib/schemas.js";
import { v7 } from "uuid";

/** How many drafts one account can keep. Expired drafts don't count. */
export const LOG_DRAFT_LIMIT = 50;

/**
 * A draft disappears this long after it was last saved. Editing starts the window over.
 * The `delete_expired_log_drafts` database function repeats this as `interval '14 days'`.
 */
export const LOG_DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function logDraftExpiryCutoff(now = Date.now()) {
	return new Date(now - LOG_DRAFT_TTL_MS);
}

/** `/drafts` is the owner editor. Image uploads from that page are refused. */
export function isLogDraftEditorPath(path: string) {
	const pathname = path.split("?")[0] ?? "";
	return pathname === "/drafts" || pathname.startsWith("/drafts/");
}

/** Staged `tmp/` note images. Permanent links already saved on a log are allowed. */
export function draftDescriptionHasNewImages(description: string, publicBase: string) {
	return findNoteImageUrls(description, publicBase).some((reference) => reference.temporary);
}

export function logDraftPath(id: string) {
	return `/draft/${id}` as const;
}

export function seasonForAdvancement(values: { experience: number; acp: number }): 1 | 8 | 9 {
	if (values.experience) return 1;
	if (values.acp) return 8;
	return 9;
}

/** DM fields a draft carries. The record id stays with the creator and is not shared. */
export interface DraftDmIdentity {
	name: string;
	DCI: string;
}

export interface OwnedDm extends DraftDmIdentity {
	id: DungeonMasterId;
	userId: UserId;
	isUser: boolean;
}

function copyDm(dm: OwnedDm): OwnedDm {
	return { id: dm.id, name: dm.name, DCI: dm.DCI, userId: dm.userId, isUser: dm.isUser };
}

/**
 * Match a draft's DM against the player's own DM records.
 * A non-empty DCI wins (treated as unique). Otherwise the trimmed name, case-insensitive.
 * No match returns a new record owned by the player with `isUser` false. Saving the log creates it.
 */
export function matchDraftDm(dms: readonly OwnedDm[], draft: DraftDmIdentity, userId: UserId): OwnedDm {
	const dci = draft.DCI.trim();
	if (dci) {
		const byDci = dms.find((dm) => dm.DCI.trim() === dci);
		if (byDci) return copyDm(byDci);
	}

	const name = draft.name.trim().toLowerCase();
	if (name) {
		const byName = dms.find((dm) => dm.name.trim().toLowerCase() === name);
		if (byName) return copyDm(byName);
	}

	return {
		id: v7() as DungeonMasterId,
		name: draft.name.trim(),
		DCI: dci,
		userId,
		isUser: false
	};
}

/**
 * Fields a character log keeps when a draft is applied.
 * Optionals match the log form input, where omitted numbers and the log type have defaults.
 */
export interface DraftFillTarget {
	id: string;
	name: string;
	date: number;
	timezone: string;
	type?: "game" | "nongame";
	experience?: number;
	acp?: number;
	tcp?: number;
	level?: number;
	gold?: number;
	dtd?: number;
	description?: string;
	dm: {
		id: string;
		name?: string;
		DCI: string;
		userId: string;
		isUser?: boolean;
	};
	magicItemsGained?: { id: string; name: string; description: string }[];
	storyAwardsGained?: { id: string; name: string; description: string }[];
}

/**
 * Copy a draft onto a new log for review.
 * Keeps the log id, and the log's date when the draft has none. Item ids are new so two players
 * can save the same draft without sharing magic-item rows.
 */
export function applyDraftToLog<T extends DraftFillTarget>(
	log: T,
	draft: LogDraftData,
	dms: readonly OwnedDm[],
	userId: UserId
): T {
	log.name = draft.name;
	if (draft.date) log.date = draft.date;
	log.timezone = draft.timezone || log.timezone;
	log.type = draft.type;
	log.experience = draft.experience;
	log.acp = draft.acp;
	log.tcp = draft.tcp;
	log.level = draft.level;
	log.gold = draft.gold;
	log.dtd = draft.dtd;
	log.description = draft.description;
	// Non-game logs hide the DM fields, so a carried-over name would silently create a DM record.
	log.dm =
		draft.type === "game"
			? matchDraftDm(dms, draft.dm, userId)
			: { id: v7() as DungeonMasterId, name: "", DCI: "", userId, isUser: false };
	log.magicItemsGained = draft.magicItemsGained.map((item) => ({
		id: v7() as ItemId,
		name: item.name,
		description: item.description
	}));
	log.storyAwardsGained = draft.storyAwardsGained.map((item) => ({
		id: v7() as ItemId,
		name: item.name,
		description: item.description
	}));
	return log;
}

/** A saved log turned into a draft: no log id, character, date, or dropped items. */
export function logToDraftData(log: {
	name: string;
	timezone: string | null;
	type: "game" | "nongame";
	experience: number;
	acp: number;
	tcp: number;
	level: number;
	gold: number;
	dtd: number;
	description: string;
	dm: DraftDmIdentity;
	magicItemsGained: { id: ItemId; name: string; description: string }[];
	storyAwardsGained: { id: ItemId; name: string; description: string }[];
}): LogDraftData {
	return {
		name: log.name,
		date: null,
		timezone: log.timezone || "",
		type: log.type,
		experience: log.experience,
		acp: log.acp,
		tcp: log.tcp,
		level: log.level,
		gold: log.gold,
		dtd: log.dtd,
		description: log.description,
		dm: { name: log.dm.name, DCI: log.dm.DCI },
		magicItemsGained: log.magicItemsGained.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description || ""
		})),
		storyAwardsGained: log.storyAwardsGained.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description || ""
		}))
	};
}
