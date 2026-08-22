<script lang="ts">
	import { CalendarDays } from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusPill from '$lib/components/kit/StatusPill.svelte';
	import type { WorkState } from '$lib/components/kit/workState';
	import { getDownloadsQuery } from '$lib/queries/downloads/DownloadQueries.svelte';
	import { derivedDownloadStatus, isWanted } from '$lib/queries/downloads/downloadStatus';
	import { getRecentReleasesQuery } from '$lib/queries/following/FollowQueries.svelte';
	import type { NewRelease } from '$lib/queries/following/types';
	import type { DownloadTask } from '$lib/types';
	import { albumHref } from '$lib/utils/entityRoutes';

	const PERIODS = [
		{ days: 30, label: '30 days' },
		{ days: 90, label: '90 days' },
		{ days: 365, label: '1 year' }
	];
	let days = $state(30);

	const releasesQuery = getRecentReleasesQuery(
		() => days,
		() => 300,
		() => true
	);
	const downloadsQuery = getDownloadsQuery();

	const tasksByReleaseGroup = $derived.by(() => {
		const map = new SvelteMap<string, DownloadTask[]>();
		for (const task of downloadsQuery.data?.items ?? []) {
			const list = map.get(task.release_group_mbid) ?? [];
			list.push(task);
			map.set(task.release_group_mbid, list);
		}
		return map;
	});

	function releaseState(item: NewRelease): { state: WorkState; label: string } {
		if (item.in_library) return { state: 'done', label: 'In library' };
		const tasks = tasksByReleaseGroup.get(item.release_group_mbid) ?? [];
		if (tasks.length === 0) return { state: 'queued', label: 'Not requested' };
		const derived = tasks.map((t) => derivedDownloadStatus(t));
		if (derived.some((d) => d === 'downloading' || d === 'processing')) {
			return { state: 'running', label: 'Downloading' };
		}
		if (derived.some((d) => d === 'awaiting_review'))
			return { state: 'attention', label: 'Needs you' };
		if (tasks.some((t) => isWanted(t))) return { state: 'waiting', label: 'Waiting' };
		if (derived.some((d) => d === 'searching' || d === 'queued')) {
			return { state: 'queued', label: 'Requested' };
		}
		if (derived.some((d) => d === 'failed')) return { state: 'failed', label: 'Failed' };
		return { state: 'queued', label: 'Requested' };
	}

	function fmtDate(dateStr: string): string {
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return dateStr;
		return d.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const groups = $derived.by(() => {
		const items = releasesQuery.data?.items ?? [];
		const byDate = new SvelteMap<string, NewRelease[]>();
		for (const item of items) {
			const key = item.first_release_date ?? 'Unknown date';
			const list = byDate.get(key) ?? [];
			list.push(item);
			byDate.set(key, list);
		}
		return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
	});
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center gap-2">
		{#each PERIODS as p (p.days)}
			<button
				type="button"
				class="rounded-control px-3 py-1.5 text-sm font-semibold {days === p.days
					? 'bg-accent text-accent-fg'
					: 'border border-border bg-surface-raised text-fg-muted hover:text-fg'}"
				onclick={() => (days = p.days)}
			>
				{p.label}
			</button>
		{/each}
	</div>
	<p class="text-xs text-fg-subtle">
		Recent releases from followed artists. There's no upstream feed of unreleased upcoming dates
		yet, so this shows what's already out.
	</p>

	{#if releasesQuery.isLoading}
		<div class="space-y-3">
			<div class="h-16 w-full animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-16 w-full animate-pulse rounded-card bg-surface-raised"></div>
		</div>
	{:else if groups.length === 0}
		<EmptyState
			icon={CalendarDays}
			title="No recent releases"
			description="Follow some artists to see their releases here."
			ctaLabel="Following"
			ctaHref="/following"
		/>
	{:else}
		<div class="space-y-6">
			{#each groups as [date, items] (date)}
				<section class="space-y-2">
					<h2 class="text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">
						{date === 'Unknown date' ? date : fmtDate(date)}
					</h2>
					<div class="space-y-2">
						{#each items as item (item.release_group_mbid)}
							{@const st = releaseState(item)}
							<a
								href={albumHref(item.release_group_mbid)}
								class="flex items-center gap-3 rounded-card border border-border bg-surface-raised px-3 py-2 hover:bg-surface-hover"
							>
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold text-fg">
										{item.artist_name} — {item.title}
									</p>
								</div>
								{#if item.primary_type}
									<span class="rounded-full bg-fg/10 px-2 py-0.5 text-xs text-fg-muted"
										>{item.primary_type}</span
									>
								{/if}
								<StatusPill state={st.state} label={st.label} />
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
