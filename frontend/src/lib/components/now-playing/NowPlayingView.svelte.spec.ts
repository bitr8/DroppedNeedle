import { page } from '@vitest/browser/context';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_API_URL: '' }
}));

vi.mock('$lib/player/createSource', () => ({
	createPlaybackSource: vi.fn(() => ({
		type: 'local' as const,
		load: vi.fn().mockResolvedValue(undefined),
		play: vi.fn(),
		pause: vi.fn(),
		seekTo: vi.fn(),
		setVolume: vi.fn(),
		getCurrentTime: vi.fn(() => 0),
		getDuration: vi.fn(() => 180),
		isSeekable: vi.fn(() => true),
		destroy: vi.fn(),
		onStateChange: vi.fn(),
		onReady: vi.fn(),
		onError: vi.fn(),
		onProgress: vi.fn()
	}))
}));

import { playerStore } from '$lib/stores/player.svelte';
import NowPlayingView from './NowPlayingView.svelte';
import type { QueueItem } from '$lib/player/types';

function track(overrides: Partial<QueueItem> = {}): QueueItem {
	return {
		trackSourceId: 'v1',
		trackName: 'Test Track',
		artistName: 'Test Artist',
		trackNumber: 1,
		albumId: 'a1',
		albumName: 'Test Album',
		artistId: 'ar1',
		coverUrl: null,
		sourceType: 'local',
		streamUrl: 'http://test/1.mp3',
		...overrides
	};
}

describe('NowPlayingView.svelte', () => {
	beforeEach(() => {
		playerStore.stop();
	});

	it('shows a library empty state when nothing is playing', async () => {
		render(NowPlayingView);
		await expect.element(page.getByText('Nothing playing')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Browse library' }))
			.toHaveAttribute('href', '/library');
	});

	it('renders track, album and artist with links when playing', async () => {
		playerStore.playQueue([track()]);
		render(NowPlayingView);

		await expect.element(page.getByText('Test Track')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Test Album' }))
			.toHaveAttribute('href', '/album/a1');
		await expect
			.element(page.getByRole('link', { name: 'Test Artist' }))
			.toHaveAttribute('href', '/artist/ar1');
	});

	it('renders an enabled seek slider once loaded', async () => {
		playerStore.playQueue([track()]);
		render(NowPlayingView);

		const slider = page.getByRole('slider', { name: 'Seek' });
		await expect.element(slider).toBeVisible();
		await expect.element(slider).toBeEnabled();
	});

	it('lists upcoming tracks and jumps to the tapped one', async () => {
		playerStore.playQueue([
			track({ trackSourceId: 'v1', trackName: 'Track A' }),
			track({ trackSourceId: 'v2', trackName: 'Track B' })
		]);
		render(NowPlayingView);

		const upNext = page.getByRole('button', { name: /Track B/ });
		await expect.element(upNext).toBeVisible();
		await upNext.click();

		await expect.element(page.getByText('Track B').first()).toBeVisible();
		expect(playerStore.currentQueueItem?.trackSourceId).toBe('v2');
	});

	it('does not render an up-next section for a single-track queue', async () => {
		playerStore.playQueue([track()]);
		render(NowPlayingView);

		await expect.element(page.getByText('Up next')).not.toBeInTheDocument();
	});
});
