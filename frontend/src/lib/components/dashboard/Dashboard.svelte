<script lang="ts">
	import { authStore } from '$lib/stores/authStore.svelte';
	import { getLibraryActivityQuery } from '$lib/queries/library/LibraryActivityQueries.svelte';
	import {
		getLibraryStatsQuery,
		getLibraryRecentlyAddedQuery
	} from '$lib/queries/library/LibraryQueries.svelte';
	import { getDownloadActivitySummaryQuery } from '$lib/queries/downloads/DownloadQueries.svelte';
	import { getLibraryReviewsQuery } from '$lib/queries/library/LibraryReviewQueries.svelte';
	import { getHomeQuery } from '$lib/queries/HomeQuery.svelte';
	import WorkRow from '$lib/components/kit/WorkRow.svelte';
	import {
		libraryWorkTitle,
		libraryWorkPhase,
		libraryWorkFacts,
		libraryWorkHref,
		libraryWorkPercentage,
		libraryWorkContext
	} from '$lib/components/library/LibraryWorkPresentation';
	import { isRunningWork, isTerminalWork, toWorkState } from './dashboardWork';
	import { formatBytes, formatRelativeTime } from '$lib/utils/formatting';
	import type { HomeAlbum } from '$lib/types';

	const reviewFilters = { state: 'needs_review' } as const;

	const activityQuery = getLibraryActivityQuery(() => authStore.user?.id);
	const statsQuery = getLibraryStatsQuery();
	const downloadsQuery = getDownloadActivitySummaryQuery();
	const reviewsQuery = getLibraryReviewsQuery(() => reviewFilters);
	const homeQuery = getHomeQuery();
	const recentlyAddedQuery = getLibraryRecentlyAddedQuery();

	const workItems = $derived(activityQuery.data?.work_items ?? []);
	const runningWork = $derived(workItems.filter(isRunningWork));
	const terminalWork = $derived(
		[...workItems.filter(isTerminalWork)].sort((a, b) => b.updated_at - a.updated_at).slice(0, 10)
	);
	const failedWork = $derived(
		workItems.filter((item) => item.state === 'failed' || item.effect === 'attention')
	);
	const attentionCards = $derived(failedWork.slice(0, 3));
	const attentionOverflow = $derived(Math.max(0, failedWork.length - attentionCards.length));

	const downloads = $derived(downloadsQuery.data);
	const downloadsState = $derived.by(() => {
		if (!downloads) return null;
		if (downloads.active_count > 0) return 'running' as const;
		if (downloads.held_count > 0 || downloads.failed_count > 0) return 'attention' as const;
		return null;
	});
	const downloadsFacts = $derived(
		downloads
			? [
					`${downloads.active_count} active`,
					downloads.held_count ? `${downloads.held_count} needs a decision` : null,
					downloads.failed_count ? `${downloads.failed_count} failed` : null
				].filter((v): v is string => v !== null)
			: []
	);

	const stats = $derived(statsQuery.data);
	const lastScan = $derived(stats?.last_scan_at ? new Date(stats.last_scan_at * 1000) : null);
	const formatEntries = $derived(
		stats ? Object.entries(stats.format_breakdown).sort((a, b) => b[1] - a[1]) : []
	);

	const reviewCount = $derived(stats?.review_count ?? 0);
	const reviewReasons = $derived(
		Object.entries(reviewsQuery.data?.pages?.[0]?.counts_by_reason ?? {})
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4)
	);

	const recentlyAdded = $derived((recentlyAddedQuery.data?.items ?? []).slice(0, 6));
	const freshReleases = $derived(
		((homeQuery.data?.fresh_releases?.items ?? []) as HomeAlbum[]).slice(0, 6)
	);

	function reasonLabel(code: string): string {
		return code.replaceAll('_', ' ');
	}
</script>

<div class="flex flex-col gap-4 p-4 text-sm text-fg">
	<h1 class="text-base font-semibold text-fg">Dashboard</h1>

	{#if attentionCards.length}
		<section class="flex flex-wrap gap-3" aria-label="Attention">
			{#each attentionCards as item (item.id)}
				<div
					class="flex min-w-[260px] flex-1 items-start gap-2 rounded-card border border-danger/30 bg-danger/10 px-3 py-2"
				>
					<span class="mt-1.5 size-2 shrink-0 rounded-full bg-danger" aria-hidden="true"></span>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold text-fg">{libraryWorkTitle(item)}</p>
						<p class="mt-0.5 truncate text-fg-muted">{libraryWorkPhase(item)}</p>
					</div>
					<a
						href={libraryWorkHref(item)}
						class="shrink-0 rounded-control bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
					>
						View
					</a>
				</div>
			{/each}
			{#if attentionOverflow > 0}
				<a
					href="/activity"
					class="flex items-center rounded-card border border-border bg-surface-raised px-3 py-2 text-fg-muted hover:text-fg"
				>
					{attentionOverflow} more in Activity
				</a>
			{/if}
		</section>
	{/if}

	<div class="grid grid-cols-12 gap-4">
		<section
			class="col-span-8 rounded-card border border-border bg-surface p-3"
			aria-label="Working now"
		>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Working now</h2>
			<div class="flex flex-col gap-2">
				{#if downloadsState}
					<WorkRow
						title="Downloads"
						state={downloadsState}
						facts={downloadsFacts}
						href="/downloads"
					/>
				{/if}
				{#each runningWork as item (item.id)}
					<WorkRow
						title={libraryWorkTitle(item)}
						state={toWorkState(item)}
						detail={[libraryWorkPhase(item), libraryWorkContext(item)].filter(Boolean).join(' · ')}
						progress={libraryWorkPercentage(item)}
						facts={libraryWorkFacts(item)}
						href={libraryWorkHref(item)}
					/>
				{/each}
				{#if !runningWork.length && !downloadsState}
					<p class="text-fg-muted">
						Nothing running.
						{#if terminalWork[0]}
							Last completed: {libraryWorkTitle(terminalWork[0])} — {formatRelativeTime(
								new Date(terminalWork[0].updated_at * 1000)
							)}.
						{/if}
					</p>
				{/if}
			</div>
		</section>

		<section
			class="col-span-4 rounded-card border border-border bg-surface p-3"
			aria-label="Needs review"
		>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
				Needs review
			</h2>
			<a href="/review" class="block text-3xl font-bold text-fg hover:text-accent">{reviewCount}</a>
			<div class="mt-2 flex flex-col gap-1">
				{#each reviewReasons as [code, count] (code)}
					<a
						href="/review?reason={encodeURIComponent(code)}"
						class="flex justify-between text-fg-muted hover:text-fg"
					>
						<span class="capitalize">{reasonLabel(code)}</span>
						<span class="font-mono">{count}</span>
					</a>
				{/each}
			</div>
		</section>
	</div>

	<div class="grid grid-cols-12 gap-4">
		<section
			class="col-span-8 rounded-card border border-border bg-surface p-3"
			aria-label="Recent activity"
		>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
					Recent activity
				</h2>
				<a href="/activity" class="text-xs text-fg-muted hover:text-fg">Everything →</a>
			</div>
			<div class="flex flex-col gap-2">
				{#each terminalWork as item (item.id)}
					<WorkRow
						title={libraryWorkTitle(item)}
						state={toWorkState(item)}
						detail={formatRelativeTime(new Date(item.updated_at * 1000))}
						facts={libraryWorkFacts(item)}
						href={libraryWorkHref(item)}
					/>
				{/each}
				{#if !terminalWork.length}
					<p class="text-fg-muted">Nothing recent yet.</p>
				{/if}
			</div>
		</section>

		<section
			class="col-span-4 rounded-card border border-border bg-surface p-3"
			aria-label="Library"
		>
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Library</h2>
			{#if stats}
				<dl class="grid grid-cols-2 gap-x-3 gap-y-1">
					<dt class="text-fg-muted">Albums</dt>
					<dd class="text-right font-mono">{stats.total_albums.toLocaleString()}</dd>
					<dt class="text-fg-muted">Tracks</dt>
					<dd class="text-right font-mono">{stats.total_tracks.toLocaleString()}</dd>
					<dt class="text-fg-muted">On disk</dt>
					<dd class="text-right font-mono">{formatBytes(stats.total_size_bytes)}</dd>
				</dl>
				{#if formatEntries.length}
					<p class="mt-1 text-fg-subtle">
						{#each formatEntries as [format, count], i (format)}{i > 0
								? ' · '
								: ''}{format.toUpperCase()}
							{count.toLocaleString()}{/each}
					</p>
				{/if}
				<p class="mt-2 text-fg-muted">
					Last scan {lastScan ? formatRelativeTime(lastScan) : 'never'}
				</p>
			{/if}
			<a
				href="/library/management?tab=scanning"
				class="mt-2 inline-block rounded-control bg-accent px-2 py-1 text-xs font-semibold text-accent-fg hover:opacity-90"
			>
				Scan now
			</a>
		</section>
	</div>

	{#if recentlyAdded.length || freshReleases.length}
		<div class="grid grid-cols-12 gap-4">
			{#if recentlyAdded.length}
				<section
					class="col-span-6 rounded-card border border-border bg-surface p-3"
					aria-label="Recently added"
				>
					<h2 class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
						Recently added
					</h2>
					<ul class="flex flex-col gap-1">
						{#each recentlyAdded as album (album.id)}
							<li class="flex justify-between gap-2 truncate">
								<a href="/album/{album.id}" class="truncate text-fg hover:underline"
									>{album.title}</a
								>
								<span class="shrink-0 text-fg-muted">{album.artist_name}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if freshReleases.length}
				<section
					class="col-span-6 rounded-card border border-border bg-surface p-3"
					aria-label="Fresh releases"
				>
					<h2 class="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
						Fresh releases
					</h2>
					<ul class="flex flex-col gap-1">
						{#each freshReleases as album (album.mbid ?? album.name)}
							<li class="flex justify-between gap-2 truncate">
								<span class="truncate text-fg">{album.name}</span>
								<span class="shrink-0 text-fg-muted">{album.artist_name}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>
