<script lang="ts">
	import { Download, TimerOff } from 'lucide-svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import EmptyState from '$lib/components/EmptyState.svelte';
	import { stopAllRetries } from '$lib/queries/downloads/DownloadMutations.svelte';
	import { getDownloadsQuery } from '$lib/queries/downloads/DownloadQueries.svelte';
	import { getHeldImportsQuery } from '$lib/queries/downloads/HeldQueries.svelte';
	import { bucketSections, collapseRetryChains } from '$lib/queries/downloads/downloadStatus';

	import DownloadItem from './DownloadItem.svelte';
	import HeldTrackCard from './HeldTrackCard.svelte';
	import ManagementHoldCard from './ManagementHoldCard.svelte';
	import NowPressingHero from './NowPressingHero.svelte';
	import WantedCard from './WantedCard.svelte';

	let { highlight = null }: { highlight?: string | null } = $props();

	const query = getDownloadsQuery();
	const heldQuery = getHeldImportsQuery();
	const held = $derived(heldQuery.data?.items ?? []);
	const managementHeld = $derived(held.filter((item) => item.reason.startsWith('management:')));
	const verificationHeld = $derived(held.filter((item) => !item.reason.startsWith('management:')));
	const managementGroups = $derived.by(() => {
		const groups = new SvelteMap<string, typeof managementHeld>();
		for (const item of managementHeld) {
			const key =
				item.source_task_id ?? `${item.release_group_mbid ?? 'unknown'}:${item.created_at}`;
			groups.set(key, [...(groups.get(key) ?? []), item]);
		}
		return [...groups.values()];
	});
	const heldTaskIds = $derived(
		new Set(held.flatMap((item) => (item.source_task_id ? [item.source_task_id] : [])))
	);

	const stopAll = stopAllRetries();

	// collapse auto-retry chains so each album is one row (latest attempt), then group into
	// the queue tab's Needs you / Active / Waiting sections
	const tasks = $derived(
		collapseRetryChains(query.data?.items ?? []).filter((task) => !heldTaskIds.has(task.id))
	);
	const sections = $derived(bucketSections(tasks));

	const hero = $derived(sections.now_spinning[0] ?? null);
	const activeRest = $derived([
		...(hero ? sections.now_spinning.slice(1) : sections.now_spinning),
		...sections.cueing
	]);
	const activeCount = $derived(sections.now_spinning.length + sections.cueing.length);
	const needsYouCount = $derived(
		sections.needs_you.length + managementGroups.length + verificationHeld.length
	);

	const isEmpty = $derived(
		activeCount === 0 && sections.wanted.length === 0 && needsYouCount === 0
	);

	const pulse = $derived(
		[
			{ n: needsYouCount, label: 'needs you', cls: 'text-info' },
			{ n: activeCount, label: 'active', cls: 'text-primary' },
			{ n: sections.wanted.length, label: 'waiting', cls: 'text-warning' }
		].filter((p) => p.n > 0)
	);

	function highlightClass(id: string): string {
		return id === highlight
			? 'rounded-3xl ring-2 ring-accent ring-offset-2 ring-offset-surface transition-shadow'
			: '';
	}

	$effect(() => {
		if (!highlight) return;
		void tasks.length;
		void held.length;
		const el = document.getElementById(`dl-${highlight}`);
		el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
</script>

<div class="space-y-7">
	{#if query.isLoading}
		<div class="space-y-3">
			<div class="h-32 w-full animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
		</div>
	{:else if query.isError}
		<div class="rounded-card border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
			Couldn't load your downloads - retrying shortly.
		</div>
	{:else if isEmpty}
		<EmptyState
			icon={Download}
			title="Nothing in the queue"
			description="Request an album and you'll watch it search, download, and land in your library here."
			ctaLabel="Browse Library"
			ctaHref="/library/albums"
		/>
	{:else}
		{#if pulse.length > 0}
			<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-subtle">
				{#each pulse as p, i (p.label)}
					{#if i > 0}<span class="text-fg-subtle/60">·</span>{/if}
					<span><span class="font-bold tabular-nums {p.cls}">{p.n}</span> {p.label}</span>
				{/each}
			</p>
		{/if}

		<!-- NEEDS YOU -->
		{#if needsYouCount > 0}
			<section class="space-y-3">
				<h2 class="dl-eyebrow">Needs you <span class="dl-count">{needsYouCount}</span></h2>

				{#if sections.needs_you.length > 0}
					<div class="space-y-3">
						<h3 class="text-xs font-semibold text-fg-subtle">Pick a release</h3>
						{#each sections.needs_you as task (task.id)}
							<div id="dl-{task.id}" class={highlightClass(task.id)}>
								<DownloadItem {task} />
							</div>
						{/each}
					</div>
				{/if}

				{#if managementGroups.length > 0}
					<div class="space-y-3">
						<h3 class="text-xs font-semibold text-fg-subtle">Organizer needs attention</h3>
						{#each managementGroups as items (items[0]?.source_task_id ?? items[0]?.id)}
							{@const groupId = items[0]?.source_task_id ?? String(items[0]?.id ?? '')}
							<div id="dl-{groupId}" class={highlightClass(groupId)}>
								<ManagementHoldCard {items} />
							</div>
						{/each}
					</div>
				{/if}

				{#if verificationHeld.length > 0}
					<div class="space-y-3">
						<h3 class="text-xs font-semibold text-fg-subtle">Couldn't verify</h3>
						{#each verificationHeld as item (item.id)}
							<div id="dl-held-{item.id}" class={highlightClass(`held-${item.id}`)}>
								<HeldTrackCard held={item} />
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ACTIVE -->
		{#if activeCount > 0}
			<section class="space-y-3">
				<h2 class="dl-eyebrow">Active <span class="dl-count">{activeCount}</span></h2>
				{#if hero}
					<div id="dl-{hero.id}" class={highlightClass(hero.id)}>
						<NowPressingHero task={hero} showEyebrow={false} />
					</div>
				{/if}
				{#each activeRest as task (task.id)}
					<div id="dl-{task.id}" class={highlightClass(task.id)}>
						<DownloadItem {task} />
					</div>
				{/each}
			</section>
		{/if}

		<!-- WAITING (auto-retry ladder) -->
		{#if sections.wanted.length > 0}
			<section class="space-y-3">
				<div class="flex items-center justify-between gap-2">
					<h2 class="dl-eyebrow">
						Waiting <span class="text-fg-subtle/70">· auto-retrying</span>
						<span class="dl-count">{sections.wanted.length}</span>
					</h2>
					<button
						class="rounded-control px-2 py-1 text-xs font-semibold text-fg-muted hover:bg-surface-hover hover:text-danger"
						onclick={() => stopAll.mutate()}
						disabled={stopAll.isPending}
						title="Stop auto-retrying everything waiting - it won't be watched for later either"
					>
						<TimerOff class="mr-1 inline h-3.5 w-3.5" /> Stop all
					</button>
				</div>
				<div class="space-y-3">
					{#each sections.wanted as task (task.id)}
						<div id="dl-{task.id}" class={highlightClass(task.id)}>
							<WantedCard {task} />
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.dl-eyebrow {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: oklch(from var(--color-fg) l c h / 0.45);
	}
	.dl-count {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0 0.4rem;
		border-radius: 9999px;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		color: oklch(from var(--color-fg) l c h / 0.6);
		background: oklch(from var(--color-fg) l c h / 0.08);
	}
</style>
