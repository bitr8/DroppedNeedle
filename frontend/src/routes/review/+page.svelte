<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { ClipboardCheck } from 'lucide-svelte';
	import EmptyState from '$lib/components/kit/EmptyState.svelte';
	import ReviewRow from '$lib/components/review/ReviewRow.svelte';
	import { REASON_OPTIONS } from '$lib/components/review/reviewReason';
	import { getLibraryReviewsQuery } from '$lib/queries/library/LibraryReviewQueries.svelte';
	import type { LibraryReviewFilters as Filters } from '$lib/queries/library/LibraryReviewQueries.svelte';

	const filters = $derived<Filters>({
		cursor: page.url.searchParams.get('cursor') ?? undefined,
		state: 'needs_review',
		reasonCode: page.url.searchParams.get('reason') ?? undefined,
		sort: page.url.searchParams.get('sort') ?? 'oldest'
	});
	const highlightId = $derived(page.url.searchParams.get('highlight'));

	const query = getLibraryReviewsQuery(() => filters);
	const response = $derived(query.data?.pages[0]);
	const items = $derived(response?.items ?? []);

	$effect(() => {
		const id = highlightId;
		if (!id || !items.length) return;
		void tick().then(() => {
			document
				.querySelector(`[data-review-id="${id}"]`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	});

	function updateUrl(next: Partial<Filters>): void {
		const params = new SvelteURLSearchParams();
		const merged = { ...filters, ...next };
		if (merged.reasonCode) params.set('reason', merged.reasonCode);
		if (merged.sort && merged.sort !== 'oldest') params.set('sort', merged.sort);
		if (merged.cursor) params.set('cursor', merged.cursor);
		void goto(`/review${params.size ? `?${params.toString()}` : ''}`, {
			noScroll: true,
			keepFocus: true
		});
	}

	function setReason(code: string | undefined): void {
		updateUrl({ reasonCode: code, cursor: undefined });
	}
</script>

<svelte:head><title>Identification review · DroppedNeedle</title></svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-6">
		<h1 class="text-3xl font-bold text-fg">Identification review</h1>
		<p class="mt-1 text-sm text-fg-muted">
			{response ? `${response.filtered_total.toLocaleString()} albums need review` : 'Loading…'}
		</p>
	</header>

	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-full px-3 py-1 text-sm font-medium {!filters.reasonCode
					? 'bg-accent text-accent-fg'
					: 'bg-surface-raised text-fg-muted hover:bg-surface-hover'}"
				onclick={() => setReason(undefined)}
			>
				All
			</button>
			{#each REASON_OPTIONS as opt (opt.code)}
				<button
					type="button"
					class="rounded-full px-3 py-1 text-sm font-medium {filters.reasonCode === opt.code
						? 'bg-accent text-accent-fg'
						: 'bg-surface-raised text-fg-muted hover:bg-surface-hover'}"
					onclick={() => setReason(opt.code)}
				>
					{opt.label}{#if response?.counts_by_reason[opt.code]}
						· {response.counts_by_reason[opt.code]}{/if}
				</button>
			{/each}
		</div>
		<select
			class="rounded-control border border-border bg-surface-raised px-2 py-1 text-sm text-fg"
			aria-label="Sort"
			value={filters.sort}
			onchange={(event) => updateUrl({ sort: event.currentTarget.value, cursor: undefined })}
		>
			<option value="oldest">Oldest first</option>
			<option value="newest">Recently updated</option>
		</select>
	</div>

	{#if query.isLoading}
		<div class="space-y-2">
			<div class="h-24 animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-24 animate-pulse rounded-card bg-surface-raised"></div>
			<div class="h-24 animate-pulse rounded-card bg-surface-raised"></div>
		</div>
	{:else if query.isError}
		<p class="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
			Could not load identification reviews.
		</p>
	{:else if items.length === 0}
		<EmptyState
			icon={ClipboardCheck}
			title="No albums need identification review."
			description="Albums the identifier can't resolve on its own will appear here."
		/>
	{:else}
		<div class="space-y-3">
			{#each items as item (item.id)}
				<ReviewRow {item} highlighted={item.id === highlightId} />
			{/each}
		</div>
		<div class="mt-4 flex items-center justify-between gap-3 text-sm text-fg-muted">
			<span>{response?.filtered_total.toLocaleString()} review items</span>
			<div class="flex gap-2">
				{#if filters.cursor}
					<button
						type="button"
						class="rounded-control border border-border px-3 py-1.5 font-semibold text-fg hover:bg-surface-hover"
						onclick={() => updateUrl({ cursor: undefined })}
					>
						First page
					</button>
				{/if}
				{#if response?.next_cursor}
					<button
						type="button"
						class="rounded-control border border-border px-3 py-1.5 font-semibold text-fg hover:bg-surface-hover"
						onclick={() => updateUrl({ cursor: response?.next_cursor ?? undefined })}
					>
						Next page
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
