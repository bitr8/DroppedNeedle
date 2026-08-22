import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SyncPill from './SyncPill.svelte';

describe('SyncPill', () => {
	it('shows a relative synced time', async () => {
		const syncedAt = new Date(Date.now() - 12 * 60_000).toISOString();
		render(SyncPill, { status: 'synced', syncedAt });
		await expect.element(page.getByText('Synced 12m ago')).toBeVisible();
	});

	it('shows Syncing with an animated indicator', async () => {
		render(SyncPill, { status: 'syncing' });
		const pill = page.getByText('Syncing');
		await expect.element(pill).toBeVisible();
		expect(pill.element().getAttribute('data-status')).toBe('syncing');
	});

	it('shows a missing-count warning when stale', async () => {
		render(SyncPill, { status: 'stale', missingCount: 9 });
		await expect.element(page.getByText('9 songs missing')).toBeVisible();
	});

	it('shows the paused message', async () => {
		render(SyncPill, { status: 'paused' });
		await expect.element(page.getByText('Sync paused — Spotify unreachable')).toBeVisible();
	});

	it('shows the error message', async () => {
		render(SyncPill, { status: 'error' });
		await expect.element(page.getByText("Couldn't sync — Retry")).toBeVisible();
	});
});
