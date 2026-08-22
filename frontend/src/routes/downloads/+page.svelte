<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { CalendarDays, Download, History, PackageOpen } from 'lucide-svelte';

	import DownloadQueue from '$lib/components/downloads/DownloadQueue.svelte';
	import DownloadsCalendarTab from '$lib/components/downloads/DownloadsCalendarTab.svelte';
	import DownloadsHistoryTab from '$lib/components/downloads/DownloadsHistoryTab.svelte';
	import FreeMusicQueue from '$lib/components/downloads/FreeMusicQueue.svelte';
	import DiscoveryBatchList from '$lib/components/discover/DiscoveryBatchList.svelte';
	import DropImportJobList from '$lib/components/import/DropImportJobList.svelte';
	import DropImportZone from '$lib/components/import/DropImportZone.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { getIntegrationStatusQuery } from '$lib/queries/HomeIntegrationStatusQuery.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';

	const integrationStatus = getIntegrationStatusQuery();

	const isAdmin = $derived(authStore.isAdmin);
	const canImport = $derived(authStore.isTrusted);
	const loaded = $derived(!integrationStatus.isLoading);
	const configured = $derived(integrationStatus.data?.download_client ?? false);

	type Tab = 'queue' | 'calendar' | 'history' | 'import';
	const VALID_TABS: Tab[] = ['queue', 'calendar', 'history', 'import'];
	function parseTab(raw: string | null): Tab {
		return raw && VALID_TABS.includes(raw as Tab) ? (raw as Tab) : 'queue';
	}

	// local state drives the UI instantly on click; the url is kept in sync for
	// shareable/back-button-stable links, matching the ?tab= deep-link contract
	let tab = $state<Tab>(parseTab(page.url.searchParams.get('tab')));
	const highlight = $derived(page.url.searchParams.get('highlight'));

	function setTab(next: Tab) {
		tab = next;
		const url = new URL(page.url);
		if (next === 'queue') url.searchParams.delete('tab');
		else url.searchParams.set('tab', next);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	let showAllImports = $state(false);
</script>

<svelte:head>
	<title>Downloads - DroppedNeedle</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-2 py-4 sm:px-4 sm:py-8 lg:px-8">
	<div class="mb-6">
		<div class="flex items-center gap-2">
			<Download class="h-6 w-6 text-accent" aria-hidden="true" />
			<h1 class="text-2xl font-bold text-fg sm:text-3xl">Downloads</h1>
		</div>
		<p class="mt-0.5 text-sm text-fg-muted">
			What's queued, what's coming, and what already landed.
		</p>
	</div>

	<div role="tablist" class="mb-6 flex flex-wrap gap-1 border-b border-border">
		<button
			role="tab"
			class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold {tab === 'queue'
				? 'border-accent text-fg'
				: 'border-transparent text-fg-muted hover:text-fg'}"
			aria-selected={tab === 'queue'}
			onclick={() => setTab('queue')}
		>
			<Download class="h-4 w-4" aria-hidden="true" /> Queue
		</button>
		<button
			role="tab"
			class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold {tab === 'calendar'
				? 'border-accent text-fg'
				: 'border-transparent text-fg-muted hover:text-fg'}"
			aria-selected={tab === 'calendar'}
			onclick={() => setTab('calendar')}
		>
			<CalendarDays class="h-4 w-4" aria-hidden="true" /> Calendar
		</button>
		<button
			role="tab"
			class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold {tab === 'history'
				? 'border-accent text-fg'
				: 'border-transparent text-fg-muted hover:text-fg'}"
			aria-selected={tab === 'history'}
			onclick={() => setTab('history')}
		>
			<History class="h-4 w-4" aria-hidden="true" /> History
		</button>
		{#if canImport}
			<button
				role="tab"
				class="flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold {tab === 'import'
					? 'border-accent text-fg'
					: 'border-transparent text-fg-muted hover:text-fg'}"
				aria-selected={tab === 'import'}
				onclick={() => setTab('import')}
			>
				<PackageOpen class="h-4 w-4" aria-hidden="true" /> Import
			</button>
		{/if}
	</div>

	{#if tab === 'import' && canImport}
		<DropImportZone className="mb-6" />
		{#if isAdmin}
			<label class="mb-3 flex items-center justify-end gap-2 text-xs text-fg-muted">
				<input type="checkbox" class="size-4 accent-accent" bind:checked={showAllImports} />
				Show everyone's imports
			</label>
		{/if}
		<DropImportJobList showAll={showAllImports} />
	{:else if tab === 'calendar'}
		<DownloadsCalendarTab />
	{:else if tab === 'history'}
		<DownloadsHistoryTab />
	{:else if !loaded}
		<div class="space-y-3">
			<div class="h-10 w-64 animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
		</div>
	{:else if !configured}
		{#if isAdmin}
			<EmptyState
				icon={Download}
				title="Download client not configured"
				description="Connect a download client to request albums."
				ctaLabel="Configure Download Client"
				ctaHref="/settings?tab=download-client"
			/>
		{:else}
			<EmptyState
				icon={Download}
				title="Download client not configured"
				description="Contact your admin to configure the download client."
			/>
		{/if}
	{:else}
		<FreeMusicQueue showAll={isAdmin} />
		<DownloadQueue {highlight} />
		<DiscoveryBatchList />
	{/if}
</div>
