<script lang="ts">
	import { CircleCheck, CircleX } from 'lucide-svelte';

	import { api } from '$lib/api/client';
	import { toastStore } from '$lib/stores/toast';

	const TOKEN_MASK = 'ma****';
	const ENDPOINT = '/api/v1/settings/music-assistant';

	type MusicAssistantSettings = { url: string; enabled: boolean; token_set: boolean };
	type TestResult = { ok: boolean; message: string; server_version?: string | null };

	let url = $state('');
	let enabled = $state(false);
	let tokenSet = $state(false);
	let token = $state('');
	let showToken = $state(false);
	let loading = $state(true);
	let testing = $state(false);
	let saving = $state(false);
	let testResult = $state<TestResult | null>(null);

	function apply(data: MusicAssistantSettings) {
		url = data.url;
		enabled = data.enabled;
		tokenSet = data.token_set;
		token = '';
	}

	function message(e: unknown, fallback: string) {
		return (e as { message?: string })?.message || fallback;
	}

	$effect(() => {
		api.global
			.get<MusicAssistantSettings>(ENDPOINT)
			.then(apply)
			.catch((e) =>
				toastStore.show({ message: message(e, 'Could not load settings'), type: 'error' })
			)
			.finally(() => (loading = false));
	});

	async function runTest() {
		testing = true;
		testResult = null;
		try {
			testResult = await api.global.post<TestResult>(`${ENDPOINT}/test`, {
				url,
				token: token || (tokenSet ? TOKEN_MASK : '')
			});
		} catch (e) {
			testResult = { ok: false, message: message(e, 'Could not reach Music Assistant') };
		} finally {
			testing = false;
		}
	}

	async function save() {
		saving = true;
		try {
			apply(
				await api.global.put<MusicAssistantSettings>(ENDPOINT, {
					url,
					enabled,
					token: token || (tokenSet ? TOKEN_MASK : '')
				})
			);
			testResult = null;
			toastStore.show({ message: 'Music Assistant saved', type: 'success' });
		} catch (e) {
			toastStore.show({ message: message(e, 'Could not save Music Assistant'), type: 'error' });
		} finally {
			saving = false;
		}
	}
</script>

<section class="space-y-4">
	<header class="space-y-1">
		<h2 class="text-lg font-semibold text-fg">Music Assistant</h2>
		<p class="max-w-prose text-sm text-fg-muted">
			Mirror what Music Assistant is playing and push playlists to it. One shared server token —
			everyone sees the same players.
		</p>
	</header>

	<div class="space-y-4 rounded-card border border-border bg-surface-raised p-5">
		<div class="space-y-1">
			<label class="text-sm text-fg" for="ma-url">Server URL</label>
			<input
				id="ma-url"
				class="w-full rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm text-fg"
				placeholder="http://192.168.1.10:8095"
				disabled={loading}
				bind:value={url}
			/>
		</div>

		<div class="space-y-1">
			<label class="text-sm text-fg" for="ma-token">Token</label>
			<div class="flex gap-2">
				<input
					id="ma-token"
					type={showToken ? 'text' : 'password'}
					class="w-full flex-1 rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm text-fg"
					placeholder={tokenSet ? 'Stored — leave blank to keep' : 'Music Assistant API token'}
					disabled={loading}
					bind:value={token}
				/>
				<button
					type="button"
					class="rounded-control border border-border px-3 py-2 text-sm text-fg-muted"
					onclick={() => (showToken = !showToken)}
				>
					{showToken ? 'Hide' : 'Show'}
				</button>
			</div>
		</div>

		<label class="flex items-center gap-3 text-sm text-fg">
			<input type="checkbox" class="accent-accent" disabled={loading} bind:checked={enabled} />
			Enabled
		</label>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				class="rounded-control border border-border px-3 py-2 text-sm text-fg"
				onclick={runTest}
				disabled={testing || !url.trim()}
			>
				{testing ? 'Testing…' : 'Test connection'}
			</button>
			{#if testResult}
				<span
					class="flex items-center gap-1.5 text-sm"
					class:text-success={testResult.ok}
					class:text-danger={!testResult.ok}
				>
					{#if testResult.ok}
						<CircleCheck class="size-4" aria-hidden="true" />
					{:else}
						<CircleX class="size-4" aria-hidden="true" />
					{/if}
					{testResult.message}
				</span>
			{/if}
			<div class="flex-1"></div>
			<button
				type="button"
				class="rounded-control bg-accent px-4 py-2 text-sm text-accent-fg"
				onclick={save}
				disabled={saving || loading}
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</div>
</section>
