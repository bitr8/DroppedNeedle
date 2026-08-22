<script lang="ts">
	import { ArrowLeft, FolderCog, ScanLine } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURL } from 'svelte/reactivity';

	import PageHeader from '$lib/components/PageHeader.svelte';
	import LibraryScanningPanel from '$lib/components/library/LibraryScanningPanel.svelte';
	import LibraryManagementControlRoom from '$lib/components/library/LibraryManagementControlRoom.svelte';
	import { getTargetLibrarySettingsQuery } from '$lib/queries/library/LibraryPolicyQueries.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';

	const settingsQuery = getTargetLibrarySettingsQuery(() => authStore.isAdmin);
	const libraryEnabled = $derived(settingsQuery.data?.enabled ?? true);

	type TabId = 'scan' | 'organize';

	// legacy tab values (overview, scanning, automation) all land on Scan
	const activeTab = $derived<TabId>(
		page.url.searchParams.get('tab') === 'organize' ? 'organize' : 'scan'
	);

	function selectTab(tab: TabId): void {
		if (tab === activeTab) return;
		const url = new SvelteURL(page.url);
		url.searchParams.set('tab', tab);
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const segmentBase =
		'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors';
	const segmentIdle = `${segmentBase} text-base-content/60 hover:bg-base-100/70 hover:text-base-content`;

	function segmentClass(tab: TabId): string {
		if (tab !== activeTab) return segmentIdle;
		if (tab === 'organize') return `${segmentBase} bg-warning/15 text-warning`;
		return `${segmentBase} bg-primary/15 text-primary glow-primary-soft`;
	}
</script>

<svelte:head><title>Library Management · DroppedNeedle</title></svelte:head>

<div class="min-h-[calc(100vh-200px)]">
	<PageHeader
		subtitle="Scan, identify, and organize your library from one place."
		gradientClass="bg-gradient-to-br from-primary/25 via-base-100 to-warning/15"
	>
		{#snippet title()}Library Management{/snippet}
		{#snippet actions()}
			<a href="/library" class="btn btn-ghost btn-sm gap-2 rounded-full sm:btn-md">
				<ArrowLeft class="h-4 w-4" />
				<span class="hidden sm:inline">Back to Library</span>
				<span class="sm:hidden">Library</span>
			</a>
		{/snippet}
	</PageHeader>

	<main class="space-y-6 px-4 pb-14 sm:px-6 lg:px-8">
		<div
			role="tablist"
			aria-label="Library Management areas"
			class="flex flex-wrap gap-1 rounded-2xl border border-base-content/10 bg-base-200/50 p-1.5"
		>
			<button
				role="tab"
				id="manage-tab-scan"
				aria-controls="manage-panel-scan"
				class={segmentClass('scan')}
				aria-selected={activeTab === 'scan'}
				onclick={() => selectTab('scan')}
			>
				<ScanLine class="h-4 w-4" />
				Scan
			</button>
			<button
				role="tab"
				id="manage-tab-organize"
				aria-controls="manage-panel-organize"
				class={segmentClass('organize')}
				aria-selected={activeTab === 'organize'}
				onclick={() => selectTab('organize')}
			>
				<FolderCog class="h-4 w-4" />
				Organize
			</button>
		</div>

		{#if activeTab === 'scan'}
			<div role="tabpanel" id="manage-panel-scan" aria-labelledby="manage-tab-scan">
				<LibraryScanningPanel />
			</div>
		{:else}
			<div role="tabpanel" id="manage-panel-organize" aria-labelledby="manage-tab-organize">
				{#if !libraryEnabled}
					<div class="alert alert-warning">
						<FolderCog class="h-5 w-5" />
						<div class="min-w-0 flex-1">
							<strong>The local library is disabled</strong>
							<p class="text-sm">
								File organization is paused. Existing catalog data and playback keep working. Enable
								the library in
								<a class="link link-primary" href="/settings?tab=library">Settings</a> to run organization
								again.
							</p>
						</div>
					</div>
				{:else}
					<LibraryManagementControlRoom />
				{/if}
			</div>
		{/if}
	</main>
</div>
