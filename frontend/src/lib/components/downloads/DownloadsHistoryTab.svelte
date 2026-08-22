<script lang="ts">
	import { History, RotateCcw, Trash2 } from 'lucide-svelte';

	import EmptyState from '$lib/components/EmptyState.svelte';
	import { clearFinished, retryAllFailed } from '$lib/queries/downloads/DownloadMutations.svelte';
	import { getDownloadsQuery } from '$lib/queries/downloads/DownloadQueries.svelte';
	import { getQuarantineQuery } from '$lib/queries/downloads/QuarantineQueries.svelte';
	import { bucketSections, collapseRetryChains } from '$lib/queries/downloads/downloadStatus';
	import { authStore } from '$lib/stores/authStore.svelte';
	import type { DownloadStatus } from '$lib/types';

	import DownloadItem from './DownloadItem.svelte';
	import QuarantinePanel from './QuarantinePanel.svelte';

	const query = getDownloadsQuery();
	const isAdmin = $derived(authStore.isAdmin);
	const quarantineQuery = getQuarantineQuery(() => isAdmin);
	const quarantineCount = $derived(isAdmin ? (quarantineQuery.data?.items.length ?? 0) : 0);

	const clear = clearFinished();
	const retryAll = retryAllFailed();

	const tasks = $derived(collapseRetryChains(query.data?.items ?? []));
	const history = $derived(bucketSections(tasks).history);
	const hasFailed = $derived(history.some((t) => t.status === 'failed'));

	type Outcome = 'all' | DownloadStatus;
	let outcome = $state<Outcome>('all');
	let source = $state('all');
	let showQuarantine = $state(false);

	const sources = $derived([...new Set(history.map((t) => t.source ?? 'unknown'))].sort());
	const filtered = $derived(
		history.filter(
			(t) =>
				(outcome === 'all' || t.status === outcome) &&
				(source === 'all' || (t.source ?? 'unknown') === source)
		)
	);
</script>

<div class="space-y-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<select
				class="rounded-control border border-border bg-surface-raised px-2 py-1.5 text-sm text-fg"
				bind:value={outcome}
				disabled={showQuarantine}
			>
				<option value="all">All outcomes</option>
				<option value="completed">Completed</option>
				<option value="partial">Partial</option>
				<option value="failed">Failed</option>
				<option value="cancelled">Cancelled</option>
			</select>
			{#if sources.length > 1}
				<select
					class="rounded-control border border-border bg-surface-raised px-2 py-1.5 text-sm text-fg"
					bind:value={source}
					disabled={showQuarantine}
				>
					<option value="all">All sources</option>
					{#each sources as s (s)}
						<option value={s}>{s}</option>
					{/each}
				</select>
			{/if}
			{#if isAdmin && quarantineCount > 0}
				<button
					type="button"
					class="rounded-control px-2.5 py-1.5 text-sm font-semibold {showQuarantine
						? 'bg-accent text-accent-fg'
						: 'border border-border bg-surface-raised text-fg-muted hover:text-fg'}"
					onclick={() => (showQuarantine = !showQuarantine)}
				>
					Quarantined <span class="tabular-nums">{quarantineCount}</span>
				</button>
			{/if}
		</div>

		{#if !showQuarantine}
			<div class="flex items-center gap-1">
				{#if hasFailed}
					<button
						type="button"
						class="flex items-center gap-1 rounded-control px-2.5 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10"
						onclick={() => retryAll.mutate()}
						disabled={retryAll.isPending}
						title="Retry every failed download"
					>
						<RotateCcw class="size-3.5" /> Retry all failed
					</button>
				{/if}
				<button
					type="button"
					class="flex items-center gap-1 rounded-control px-2.5 py-1.5 text-sm font-semibold text-fg-muted hover:bg-surface-hover hover:text-danger"
					onclick={() => clear.mutate()}
					disabled={clear.isPending}
					title="Remove completed and cancelled downloads from this list"
				>
					<Trash2 class="size-3.5" /> Clear
				</button>
			</div>
		{/if}
	</div>

	{#if showQuarantine}
		<QuarantinePanel />
	{:else if query.isLoading}
		<div class="space-y-3">
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-20 w-full animate-pulse rounded-card bg-surface-raised"></div>
		</div>
	{:else if filtered.length === 0}
		<EmptyState
			icon={History}
			title="No history yet"
			description="Completed and failed downloads land here once they finish."
		/>
	{:else}
		<div class="space-y-3">
			{#each filtered as task (task.id)}
				<DownloadItem {task} />
			{/each}
		</div>
	{/if}
</div>
