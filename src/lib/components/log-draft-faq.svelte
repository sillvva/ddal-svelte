<script lang="ts">
	import { LOG_DRAFT_LIMIT, LOG_DRAFT_TTL_MS } from "#lib/log-draft.js";

	const ttlDays = LOG_DRAFT_TTL_MS / (24 * 60 * 60 * 1000);
</script>

<section class="flex max-w-xl flex-col gap-4" aria-labelledby="log-draft-faq-title">
	<h3 id="log-draft-faq-title" class="text-lg font-semibold">Drafts FAQ</h3>

	<div class="flex flex-col gap-2" role="group" aria-labelledby="log-draft-faq-dm">
		<h4 id="log-draft-faq-dm" class="font-semibold">For DMs</h4>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">What is a player draft for?</summary>
			<div class="collapse-content text-sm">
				<p>
					Fill in a session's log once and share it with your table. Each player then fills a new log on their own character from
					it, instead of typing the title, date, DM, advancement, treasure, downtime, items, and notes themselves.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How do I create a draft?</summary>
			<div class="collapse-content flex flex-col gap-2 text-sm">
				<p>
					On <a class="link" href="/dm-logs">DM Logs</a>, open the arrow next to <span class="font-semibold">New Log</span> and
					choose <span class="font-semibold">New Player Draft</span>. The form starts with today's date and your own DM name and
					DCI. Choose <span class="font-semibold">Save Draft</span> to get the link.
				</p>
				<p>
					You can also choose <span class="font-semibold">Copy as draft</span> on a log you already saved, from DM Logs or a character.
					The draft gets everything except the date, the character, and any items the log dropped. That copy is also kept in your
					browser, so you can use it on your own characters.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How do I share it?</summary>
			<div class="collapse-content text-sm">
				<p>
					After saving, use <span class="font-semibold">Copy link</span> or <span class="font-semibold">Show QR code</span>. Both
					open this page. Anyone signed in who has the link can open the draft.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How long does a draft last?</summary>
			<div class="collapse-content text-sm">
				<p>
					{ttlDays} days after you last saved it. Saving it again starts the {ttlDays} days over and keeps the same link. Once it
					expires the link shows "Draft not found", and the draft is deleted. Logs players already saved from it are not affected.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How many drafts can I keep?</summary>
			<div class="collapse-content text-sm">
				<p>
					Up to {LOG_DRAFT_LIMIT} at a time. Expired drafts don't count. At the limit, delete a draft before creating another.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How do I edit or delete a draft?</summary>
			<div class="collapse-content flex flex-col gap-2 text-sm">
				<p>
					Only you can. Open the draft's link and choose <span class="font-semibold">Edit draft</span>, then
					<span class="font-semibold">Save Draft</span> or <span class="font-semibold">Delete draft</span>. There is no list of your
					drafts, so keep the link.
				</p>
				<p>
					Deleting stops the link working. A player who opened the link earlier keeps the copy in their browser until it expires or
					they open the link again, and the same goes for edits. Logs players already saved never change.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">Can a draft include images?</summary>
			<div class="collapse-content text-sm">
				<p>
					You can't upload images to a draft's notes. <span class="font-semibold">Copy as draft</span> keeps image links that are already
					saved on the log you copy.
				</p>
			</div>
		</details>
	</div>

	<div class="flex flex-col gap-2" role="group" aria-labelledby="log-draft-faq-player">
		<h4 id="log-draft-faq-player" class="font-semibold">For players</h4>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">What happens when I open a draft link?</summary>
			<div class="collapse-content text-sm">
				<p>
					The draft is saved in this browser until the date shown above. A browser holds one draft at a time, so opening another
					draft's link replaces it. Nothing is added to your characters yet.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How do I turn it into a log?</summary>
			<div class="collapse-content flex flex-col gap-2 text-sm">
				<p>
					Open a character, then the arrow next to <span class="font-semibold">New Log</span>, and choose
					<span class="font-semibold">New Log from Draft</span>. The new log form fills in straight away. On any other new log, use
					<span class="font-semibold">Populate from draft</span> in the bar at the top of the form.
				</p>
				<p>
					Check the log and save it. Nothing is saved until you do. The draft stays in your browser, so you can use it on another
					character too.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">What gets filled in?</summary>
			<div class="collapse-content text-sm">
				<p>
					The log type, title, advancement, gold, downtime, notes, magic items, and story awards. The date is filled in when the
					draft has one; otherwise the log keeps its own. These replace whatever was in those fields.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">How is the DM filled in?</summary>
			<div class="collapse-content flex flex-col gap-2 text-sm">
				<p>
					The draft's DM is matched to your own DM records: first by DCI, if the draft has one, then by name, ignoring case. If
					nothing matches, a new DM is created from the draft's name and DCI when you save the log.
				</p>
				<p>Non-game drafts, such as purchases or trades, have no DM.</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">Can I change the draft?</summary>
			<div class="collapse-content text-sm">
				<p>
					Only the person who created it can. Change your own log before you save it instead. Your saved log won't change if the
					draft is edited later.
				</p>
			</div>
		</details>

		<details class="collapse-arrow collapse border border-base-300 bg-base-100">
			<summary class="collapse-title font-semibold">Why does a draft link say "Draft not found"?</summary>
			<div class="collapse-content text-sm">
				<p>
					The draft expired or its creator deleted it. Opening the link also removes that draft from your browser. Ask the creator
					for a new one.
				</p>
			</div>
		</details>
	</div>
</section>
