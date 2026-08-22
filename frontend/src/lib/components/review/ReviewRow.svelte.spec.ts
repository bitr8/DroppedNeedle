import { page } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const h = vi.hoisted(() => ({
	query: { data: undefined, isLoading: false, isError: false } as Record<string, unknown>,
	accept: vi.fn(),
	skip: vi.fn(),
	exclude: vi.fn(),
	retry: vi.fn()
}));

vi.mock('$lib/queries/library/LibraryReviewQueries.svelte', () => ({
	getLibraryReviewQuery: () => h.query
}));
vi.mock('$lib/queries/library/LibraryReviewMutations.svelte', () => ({
	acceptLibraryReviewCandidate: () => ({ mutateAsync: h.accept, isPending: false }),
	actOnLibraryReview: (action: string) => ({
		mutateAsync: action === 'exclude' ? h.exclude : h.skip,
		isPending: false
	}),
	retryLibraryReview: () => ({ mutateAsync: h.retry, isPending: false })
}));

import ReviewRow from './ReviewRow.svelte';
import type { ReviewListItem } from '$lib/queries/library/LibraryOperationsTypes';

const item: ReviewListItem = {
	id: 'review-1',
	state: 'needs_review',
	reason_code: 'CONTRADICTORY',
	local_album_id: 'local-album-1',
	local_track_id: null,
	album_title: 'The Local Album',
	album_artist_name: 'Various Artists',
	year: 2024,
	track_count: 3,
	metadata_incomplete_count: 0,
	root_id: 'root-1',
	relative_path: 'album/',
	effective_policy: 'automatic',
	exclusion_source: null,
	release_group_mbid: null,
	identity_source: null,
	candidate_count: 2,
	evidence_summary: {},
	active_job_state: null,
	created_at: 1,
	updated_at: 2,
	row_revision: 4
};

function detail() {
	return {
		review: { ...item, row_revision: 4 },
		tracks: [],
		current_evidence: null,
		candidates: [
			{
				candidate_key: 'candidate-safe',
				evidence_revision: 'evidence-1',
				automatic_safe: true,
				evidence: {
					release_group_mbid: 'rg-safe',
					release_mbid: null,
					album_title: 'Safe Release',
					album_artist_name: 'Artist',
					artist_mbid: null,
					release_type: 'album',
					release_date: '2024',
					local_album_title: 'The Local Album',
					local_album_artist_name: 'Various Artists',
					album_title_classification: 'supported',
					album_artist_classification: 'supported',
					track_evidence: [],
					unmatched_expected_tracks: [],
					score: 0.97,
					margin: 0.3,
					reason_code: 'SUPPORTED',
					matcher_version: 'v1'
				}
			},
			{
				candidate_key: 'candidate-manual',
				evidence_revision: 'evidence-2',
				automatic_safe: false,
				evidence: {
					release_group_mbid: 'rg-manual',
					release_mbid: 'release-manual',
					album_title: 'Manual Release',
					album_artist_name: 'Artist',
					artist_mbid: null,
					release_type: 'album',
					release_date: '2024',
					local_album_title: 'The Local Album',
					local_album_artist_name: 'Various Artists',
					album_title_classification: 'contradictory',
					album_artist_classification: 'unknown',
					track_evidence: [],
					unmatched_expected_tracks: [],
					score: 0.6,
					margin: 0.01,
					reason_code: 'CONTRADICTORY',
					matcher_version: 'v1'
				}
			}
		],
		supported: [],
		unknown: [],
		contradictory: [],
		history: [],
		available_actions: ['keep_tagged', 'retry', 'exclude', 'dismiss', 'accept_candidate'],
		catalog_revision: 9,
		album_revision: 3,
		input_revision: 'input-1',
		evidence_revision: 'evidence-1',
		identity_revision: null,
		job_revision: null
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	h.query = { data: detail(), isLoading: false, isError: false };
});

describe('ReviewRow', () => {
	it('shows the reason chip and a colour-ramped confidence badge per candidate', async () => {
		render(ReviewRow, { item });
		await expect.element(page.getByText('Conflicting evidence')).toBeVisible();
		await expect.element(page.getByText('97%')).toBeVisible();
		await expect.element(page.getByText('60%')).toBeVisible();
	});

	it('accepts a safe candidate with one click, no confirmation', async () => {
		render(ReviewRow, { item });
		await page.getByRole('button', { name: 'Accept' }).click();
		expect(h.accept).toHaveBeenCalledWith(
			expect.objectContaining({
				reviewId: 'review-1',
				body: expect.objectContaining({ candidate_key: 'candidate-safe', manual_override: false })
			})
		);
	});

	it('requires confirmation before accepting a conflicting candidate', async () => {
		render(ReviewRow, { item });
		await page.getByRole('button', { name: 'Manual Release' }).click();
		await page.getByRole('button', { name: 'Accept' }).click();
		expect(h.accept).not.toHaveBeenCalled();
		await expect
			.element(page.getByRole('heading', { name: 'Use this release despite conflicts?' }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Use anyway' }).click();
		expect(h.accept).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ candidate_key: 'candidate-manual', manual_override: true })
			})
		);
	});

	it('skips with one click and confirms before marking not in library', async () => {
		render(ReviewRow, { item });
		await page.getByRole('button', { name: 'Skip' }).click();
		expect(h.skip).toHaveBeenCalledOnce();
		expect(h.exclude).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Mark as not in library…' }).click();
		const dialog = page.getByRole('dialog', {
			name: 'Mark "The Local Album" as not in library?'
		});
		await expect.element(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Mark as not in library' }).click();
		expect(h.exclude).toHaveBeenCalledOnce();
	});
});
