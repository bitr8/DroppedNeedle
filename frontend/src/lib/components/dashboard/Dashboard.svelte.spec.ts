import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { LibraryWorkItem } from '$lib/queries/library/LibraryOperationsTypes';

vi.mock('$lib/stores/authStore.svelte', () => ({
	authStore: { user: { id: 'u1', role: 'admin' } }
}));

function workItem(overrides: Partial<LibraryWorkItem>): LibraryWorkItem {
	return {
		id: 'w1',
		kind: 'scan',
		state: 'indexing',
		phase: 'indexing',
		mode: null,
		effect: 'catalog_only',
		processed: 10,
		total: 100,
		unit: 'files',
		indeterminate: false,
		remaining_count: null,
		subject_count: null,
		started_at: 0,
		updated_at: 1_700_000_000,
		origin: null,
		profile_name: null,
		scope_label: null,
		new_count: 0,
		changed_count: 0,
		missing_count: 0,
		warning_count: 0,
		blocked_count: 0,
		succeeded_count: 0,
		failed_count: 0,
		skipped_count: 0,
		priority: 0,
		failure_event_id: null,
		failure_at: null,
		...overrides
	};
}

const { activityState, statsState, downloadsState, reviewsState, homeState, recentlyAddedState } =
	vi.hoisted(() => ({
		activityState: { data: undefined as { work_items: LibraryWorkItem[] } | undefined },
		statsState: { data: undefined as Record<string, unknown> | undefined },
		downloadsState: { data: undefined as Record<string, unknown> | undefined },
		reviewsState: { data: undefined as { pages: Record<string, unknown>[] } | undefined },
		homeState: { data: undefined as Record<string, unknown> | undefined },
		recentlyAddedState: { data: undefined as { items: unknown[] } | undefined }
	}));

vi.mock('$lib/queries/library/LibraryActivityQueries.svelte', () => ({
	getLibraryActivityQuery: () => activityState
}));
vi.mock('$lib/queries/library/LibraryQueries.svelte', () => ({
	getLibraryStatsQuery: () => statsState,
	getLibraryRecentlyAddedQuery: () => recentlyAddedState
}));
vi.mock('$lib/queries/downloads/DownloadQueries.svelte', () => ({
	getDownloadActivitySummaryQuery: () => downloadsState
}));
vi.mock('$lib/queries/library/LibraryReviewQueries.svelte', () => ({
	getLibraryReviewsQuery: () => reviewsState
}));
vi.mock('$lib/queries/HomeQuery.svelte', () => ({
	getHomeQuery: () => homeState
}));

import Dashboard from './Dashboard.svelte';

describe('Dashboard', () => {
	it('shows the empty state when nothing is running', async () => {
		activityState.data = { work_items: [] };
		downloadsState.data = { active_count: 0, held_count: 0, failed_count: 0 };
		statsState.data = undefined;
		reviewsState.data = undefined;
		homeState.data = undefined;
		recentlyAddedState.data = undefined;

		render(Dashboard);
		await expect.element(page.getByText('Nothing running.')).toBeVisible();
	});

	it('renders a running work row and the needs-review count', async () => {
		activityState.data = { work_items: [workItem({ id: 'scan-1' })] };
		downloadsState.data = { active_count: 2, held_count: 1, failed_count: 0 };
		statsState.data = {
			total_albums: 1200,
			total_tracks: 15000,
			total_size_bytes: 5_000_000_000,
			format_breakdown: { flac: 900, mp3: 300 },
			review_count: 16,
			last_scan_at: 1_700_000_000
		};
		reviewsState.data = { pages: [{ counts_by_reason: { low_confidence: 12, no_candidates: 3 } }] };

		render(Dashboard);
		await expect.element(page.getByText('Scanning library')).toBeVisible();
		await expect.element(page.getByText('Downloads')).toBeVisible();
		await expect.element(page.getByText('16')).toBeVisible();
	});

	it('surfaces a failed work item in the attention strip', async () => {
		activityState.data = {
			work_items: [workItem({ id: 'scan-2', state: 'failed', phase: 'indexing' })]
		};
		downloadsState.data = { active_count: 0, held_count: 0, failed_count: 0 };

		render(Dashboard);
		await expect
			.element(page.getByLabelText('Attention').getByText('Library scan failed'))
			.toBeVisible();
		await expect.element(page.getByRole('link', { name: 'View' })).toBeVisible();
	});
});
