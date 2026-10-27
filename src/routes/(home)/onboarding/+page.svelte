<script lang="ts">
	import Control from "#lib/components/forms/control.svelte";
	import ImageUpload from "#lib/components/forms/image-upload.svelte";
	import Input from "#lib/components/forms/input.svelte";
	import RemoteForm from "#lib/components/forms/remote-form.svelte";
	import Submit from "#lib/components/forms/submit.svelte";
	import Head from "#lib/components/head.svelte";
	import * as API from "#lib/remote/index.js";
	import { onboardingSchema } from "#lib/schemas.js";
	import { getGlobal } from "#lib/stores.svelte.js";

	const global = getGlobal();
	await API.auth.queries.onboarding();

	let avatarUploading = $state(false);
</script>

<Head title="Create your account" />

<main class="relative container mx-auto flex flex-1 flex-col items-center justify-center gap-8 p-4 pb-20">
	<div class="flex flex-col items-center gap-3">
		<img src="/images/{global.app.settings.mode === 'dark' ? 'dragon' : 'dragon-dark'}.webp" alt="" class="size-40" />
		<h1 class="text-center font-draconis text-4xl text-base-content lg:text-6xl dark:text-white">Create your account</h1>
		<p class="max-w-md text-center text-base-content">
			Choose a username and email to finish signing up. A profile picture is optional.
		</p>
	</div>

	<div class="w-full max-w-md">
		<RemoteForm schema={onboardingSchema} form={API.auth.forms.completeOnboarding} successMessage={false}>
			{#snippet children(ctx)}
				{const { form } = $derived(ctx)}
				<Control class="col-span-12">
					<span class="fieldset-legend">Profile picture</span>
					<p class="text-sm text-pretty text-base-content/70">Optional. You can change it later in settings.</p>
					<ImageUpload
						purpose="avatar"
						onpending={(pending) => (avatarUploading = pending)}
						onstaged={(staged) => form.fields.uploadId.set(staged.uploadId)}
					/>
					<Input field={form.fields.uploadId} type="hidden" />
				</Control>
				<Control class="col-span-12">
					<Input field={form.fields.name} label="Username" autocomplete="username" required />
				</Control>
				<Control class="col-span-12">
					<Input field={form.fields.email} type="email" label="Email" autocomplete="email" required />
				</Control>
				<div class="col-span-12 mt-4 flex justify-center">
					<Submit form={ctx} value="Continue" disabled={avatarUploading}>Continue</Submit>
				</div>
			{/snippet}
		</RemoteForm>

		<form {...API.auth.forms.cancelOnboarding} class="mt-2 flex justify-center">
			<button
				type="submit"
				class="btn btn-ghost"
				onclick={(event) => {
					if (!confirm("Cancel account setup? Your passkey will be deleted.")) event.preventDefault();
				}}
			>
				Cancel
			</button>
		</form>
	</div>
</main>
