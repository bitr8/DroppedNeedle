import { page } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const h = vi.hoisted(() => ({
	goto: vi.fn(),
	url: new URL('http://localhost/library'),
	unfollowMutate: vi.fn(),
	toastUndo: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto: (...args: unknown[]) => h.goto(...args) }));
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return h.url;
		}
	}
}));

vi.mock('$lib/components/AlbumImage.svelte', () => {
	const Component = function () {};
	Component.prototype = {};
	return { default: Component };
});
vi.mock('$lib/components/ArtistImage.svelte', () => {
	const Component = function () {};
	Component.prototype = {};
	return { default: Component };
});

vi.mock('$lib/stores/player.svelte', () => ({
	playerStore: { playQueue: vi.fn(), addMultipleToQueue: vi.fn() }
}));
vi.mock('$lib/stores/playlistModal.svelte', () => ({ openGlobalPlaylistModal: vi.fn() }));
vi.mock('$lib/stores/toast', () => ({
	toastStore: { undo: (...args: unknown[]) => h.toastUndo(...args), show: vi.fn() }
}));

const fixtures = vi.hoisted(() => ({
	albums: [
		{
			id: 'local-album-1',
			title: 'Local Only Album',
			artist_name: 'Local Artist',
			musicbrainz_release_group_id: null,
			cover_available: true
		},
		{
			id: 'linked-album-1',
			title: 'Linked Album',
			artist_name: 'Linked Artist',
			musicbrainz_release_group_id: 'rg-1',
			cover_available: false
		}
	],
	artistPages: [
		{
			total: 5,
			album_artist_total: 5,
			contributor_total: 0,
			items: [{ id: 'artist-1', name: 'First Artist', musicbrainz_artist_id: 'mbid-1' }]
		}
	],
	tracks: [
		{
			id: 'track-1',
			title: 'Opening Track',
			artist_name: 'Track Artist',
			album_title: 'Track Album',
			album_id: 'album-1',
			cover_available: true,
			duration_seconds: 245
		}
	],
	followed: [{ mbid: 'followed-1', name: 'Followed Artist', image_url: null }]
}));

vi.mock('$lib/queries/library/LibraryQueries.svelte', () => ({
	getLibraryAlbumsQuery: () => ({
		data: { items: fixtures.albums, total: fixtures.albums.length },
		isLoading: false,
		isFetching: false
	}),
	getLibraryArtistsInfiniteQuery: () => ({
		data: { pages: fixtures.artistPages },
		isLoading: false,
		hasNextPage: true,
		isFetchingNextPage: false,
		fetchNextPage: vi.fn()
	})
}));

vi.mock('$lib/queries/following/FollowQueries.svelte', () => ({
	getFollowedArtistsQuery: () => ({ data: fixtures.followed, isLoading: false })
}));

vi.mock('$lib/queries/following/FollowMutations.svelte', () => ({
	createUnfollowMutation: () => ({ mutate: (...args: unknown[]) => h.unfollowMutate(...args) }),
	createSetFollowMutation: () => ({ mutate: vi.fn() })
}));

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: () => ({
		data: { items: fixtures.tracks, total: fixtures.tracks.length },
		isLoading: false,
		isFetching: false
	}),
	keepPreviousData: undefined
}));

import UserLibrary from './UserLibrary.svelte';

beforeEach(() => {
	vi.clearAllMocks();
	h.url = new URL('http://localhost/library');
});

afterEach(() => {
	vi.useRealTimers();
});

describe('UserLibrary albums scope (default)', () => {
	it('renders album cards with a play button and album-page links', async () => {
		render(UserLibrary);

		await expect.element(page.getByText('Local Only Album')).toBeVisible();
		await expect.element(page.getByText('Linked Album')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Open Linked Album' }))
			.toHaveAttribute('href', '/album/rg-1');
		await expect
			.element(page.getByRole('link', { name: 'Open Local Only Album' }))
			.toHaveAttribute('href', '/album/local-album-1');
		await expect
			.element(page.getByRole('button', { name: 'Play Linked Album' }))
			.toBeInTheDocument();
	});

	it('does not render quality badges or management verbs', async () => {
		render(UserLibrary);

		await expect.element(page.getByText('FLAC')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Re-identify' })).not.toBeInTheDocument();
	});
});

describe('UserLibrary scope switching', () => {
	it('updates the URL scope param when a different segment is selected', async () => {
		render(UserLibrary);

		await page.getByRole('button', { name: 'Artists' }).click();

		expect(h.goto).toHaveBeenCalledTimes(1);
		const destination = h.goto.mock.calls[0]?.[0] as URL;
		expect(destination.searchParams.get('scope')).toBe('artists');
	});

	it('debounces the search box into a q param', async () => {
		vi.useFakeTimers();
		render(UserLibrary);

		await page.getByRole('textbox', { name: 'Search albums' }).fill('mix');
		await vi.advanceTimersByTimeAsync(400);

		expect(h.goto).toHaveBeenCalled();
		const destination = h.goto.mock.calls.at(-1)?.[0] as URL;
		expect(destination.searchParams.get('q')).toBe('mix');
	});
});

describe('UserLibrary artists scope', () => {
	it('renders artist cards and a load-more control', async () => {
		h.url = new URL('http://localhost/library?scope=artists');
		render(UserLibrary);

		await expect.element(page.getByText('First Artist')).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Open First Artist' }))
			.toHaveAttribute('href', '/artist/mbid-1');
		await expect.element(page.getByRole('button', { name: /Load more/ })).toBeVisible();
	});
});

describe('UserLibrary tracks scope', () => {
	it('renders track rows with play control', async () => {
		h.url = new URL('http://localhost/library?scope=tracks');
		render(UserLibrary);

		await expect.element(page.getByText('Opening Track')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Play Opening Track' })).toBeVisible();
	});
});

describe('UserLibrary following scope', () => {
	it('renders followed artists and unfollows with an undo toast', async () => {
		h.url = new URL('http://localhost/library?scope=following');
		render(UserLibrary);

		await expect.element(page.getByText('Followed Artist')).toBeVisible();
		await page.getByRole('button', { name: 'Unfollow Followed Artist' }).click();

		expect(h.unfollowMutate).toHaveBeenCalledWith('followed-1');
		expect(h.toastUndo).toHaveBeenCalledTimes(1);
	});
});
