<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		Disc3,
		ListMusic,
		ListPlus,
		Music2,
		Play,
		Search,
		Shuffle,
		Users,
		X
	} from 'lucide-svelte';
	import { API } from '$lib/constants';
	import { api } from '$lib/api/client';
	import AlbumImage from '$lib/components/AlbumImage.svelte';
	import ArtistImage from '$lib/components/ArtistImage.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import type { MenuItem } from '$lib/components/ContextMenu.svelte';
	import EmptyState from '$lib/components/kit/EmptyState.svelte';
	import { playerStore } from '$lib/stores/player.svelte';
	import { toastStore } from '$lib/stores/toast';
	import { openGlobalPlaylistModal } from '$lib/stores/playlistModal.svelte';
	import { buildDiscoveryQueueFromLocal } from '$lib/player/queueHelpers';
	import { albumHref, artistHref } from '$lib/utils/entityRoutes';
	import { formatDurationSec } from '$lib/utils/formatting';
	import {
		getLibraryAlbumsQuery,
		getLibraryArtistsInfiniteQuery
	} from '$lib/queries/library/LibraryQueries.svelte';
	import { getFollowedArtistsQuery } from '$lib/queries/following/FollowQueries.svelte';
	import {
		createSetFollowMutation,
		createUnfollowMutation
	} from '$lib/queries/following/FollowMutations.svelte';
	import type { FollowedArtist } from '$lib/queries/following/types';
	import type {
		LibraryAlbumSummary,
		LibraryArtistSummary,
		NativeTrackListItem,
		NativeTrackPage
	} from '$lib/types';

	type Scope = 'albums' | 'artists' | 'tracks' | 'following';
	const SCOPES: { value: Scope; label: string }[] = [
		{ value: 'albums', label: 'Albums' },
		{ value: 'artists', label: 'Artists' },
		{ value: 'tracks', label: 'Tracks' },
		{ value: 'following', label: 'Following' }
	];
	const TRACK_PAGE = 48;
	const SEARCH_DEBOUNCE_MS = 300;

	const scope = $derived.by(() => {
		const s = page.url.searchParams.get('scope');
		return (SCOPES.some((o) => o.value === s) ? s : 'albums') as Scope;
	});
	const q = $derived(page.url.searchParams.get('q') ?? '');

	let searchInput = $derived(q);
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	$effect(() => () => clearTimeout(searchTimeout));

	function setParams(updates: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (!value) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function selectScope(next: Scope) {
		setParams({ scope: next === 'albums' ? null : next });
	}

	function handleSearchInput(e: Event) {
		searchInput = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(
			() => setParams({ q: searchInput.trim() || null }),
			SEARCH_DEBOUNCE_MS
		);
	}

	function clearSearch() {
		searchInput = '';
		clearTimeout(searchTimeout);
		setParams({ q: null });
	}

	// --- albums ---
	let albumPage = $state(1);
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track reactivity
		q;
		albumPage = 1;
	});
	const albumsQuery = getLibraryAlbumsQuery(() => ({
		page: albumPage,
		sort: 'recent',
		q,
		format: ''
	}));
	let albumItems = $state<LibraryAlbumSummary[]>([]);
	$effect(() => {
		const data = albumsQuery.data;
		if (!data) return;
		albumItems = albumPage === 1 ? data.items : [...albumItems, ...data.items];
	});
	const albumTotal = $derived(albumsQuery.data?.total ?? 0);

	async function fetchAlbumQueue(albumId: string) {
		const data = await api.global.get<NativeTrackPage>(API.library.albumTracks(albumId));
		return buildDiscoveryQueueFromLocal(data.items);
	}
	async function playAlbum(album: LibraryAlbumSummary, shuffle = false) {
		const items = await fetchAlbumQueue(album.id);
		if (items.length) playerStore.playQueue(items, 0, shuffle);
	}
	async function queueAlbum(album: LibraryAlbumSummary) {
		const items = await fetchAlbumQueue(album.id);
		if (items.length) playerStore.addMultipleToQueue(items);
	}
	async function addAlbumToPlaylist(album: LibraryAlbumSummary) {
		const items = await fetchAlbumQueue(album.id);
		if (items.length) openGlobalPlaylistModal(items);
	}
	function albumMenuItems(album: LibraryAlbumSummary): MenuItem[] {
		return [
			{ label: 'Play', icon: Play, onclick: () => void playAlbum(album) },
			{ label: 'Shuffle', icon: Shuffle, onclick: () => void playAlbum(album, true) },
			{ label: 'Add to playlist', icon: ListMusic, onclick: () => void addAlbumToPlaylist(album) },
			{ label: 'Add to queue', icon: ListPlus, onclick: () => void queueAlbum(album) }
		];
	}

	// --- artists ---
	const artistsParams = $derived({
		sortBy: 'name' as const,
		sortOrder: 'asc' as const,
		q,
		scope: 'album' as const
	});
	const artistsQuery = getLibraryArtistsInfiniteQuery(() => artistsParams);
	const artistItems = $derived.by(() => {
		const seen = new SvelteSet<string>();
		const out: LibraryArtistSummary[] = [];
		for (const response of artistsQuery.data?.pages ?? []) {
			for (const item of response.items) {
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				out.push(item);
			}
		}
		return out;
	});
	const artistTotal = $derived(artistsQuery.data?.pages[0]?.total ?? 0);

	// --- tracks ---
	let trackOffset = $state(0);
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track reactivity
		q;
		trackOffset = 0;
	});
	const tracksQuery = createQuery(() => ({
		staleTime: 60_000,
		placeholderData: keepPreviousData,
		queryKey: ['user-library-tracks', trackOffset, q],
		queryFn: ({ signal }: { signal: AbortSignal }) =>
			api.global.get<NativeTrackPage>(
				API.library.tracks(TRACK_PAGE, trackOffset, 'recent', q || undefined),
				{
					signal
				}
			)
	}));
	let trackItems = $state<NativeTrackListItem[]>([]);
	$effect(() => {
		const data = tracksQuery.data;
		if (!data) return;
		trackItems = trackOffset === 0 ? data.items : [...trackItems, ...data.items];
	});
	const trackTotal = $derived(tracksQuery.data?.total ?? 0);

	function playTrack(index: number) {
		const items = buildDiscoveryQueueFromLocal(trackItems);
		if (items.length) playerStore.playQueue(items, index, false);
	}
	function trackMenuItems(track: NativeTrackListItem): MenuItem[] {
		return [
			{
				label: 'Add to queue',
				icon: ListPlus,
				onclick: () => playerStore.addMultipleToQueue(buildDiscoveryQueueFromLocal([track]))
			},
			{
				label: 'Add to playlist',
				icon: ListMusic,
				onclick: () => openGlobalPlaylistModal(buildDiscoveryQueueFromLocal([track]))
			}
		];
	}

	// --- following ---
	const followedQuery = getFollowedArtistsQuery();
	const followedItems = $derived.by(() => {
		const items = followedQuery.data ?? [];
		const term = q.trim().toLowerCase();
		return term ? items.filter((a) => a.name.toLowerCase().includes(term)) : items;
	});
	const unfollowMutation = createUnfollowMutation();
	let refollowMbid = $state('');
	const refollowMutation = createSetFollowMutation(() => refollowMbid);

	function unfollow(artist: FollowedArtist) {
		unfollowMutation.mutate(artist.mbid);
		toastStore.undo(`Unfollowed ${artist.name}`, () => {
			refollowMbid = artist.mbid;
			refollowMutation.mutate(true);
		});
	}
</script>

<div class="space-y-6 px-4 pb-12 sm:px-6 lg:px-8">
	<h1 class="pt-6 text-2xl font-bold text-fg">Library</h1>

	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div
			role="group"
			aria-label="Library view"
			class="inline-flex gap-1 rounded-control bg-surface-raised p-1"
		>
			{#each SCOPES as opt (opt.value)}
				<button
					type="button"
					aria-pressed={scope === opt.value}
					class="rounded-control px-3 py-1.5 text-sm font-semibold whitespace-nowrap {scope ===
					opt.value
						? 'bg-accent text-accent-fg'
						: 'text-fg-muted hover:bg-surface-hover hover:text-fg'}"
					onclick={() => selectScope(opt.value)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
		<div class="relative sm:w-72">
			<Search
				class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
			/>
			<input
				type="text"
				placeholder="Search your library…"
				value={searchInput}
				oninput={handleSearchInput}
				class="w-full rounded-control border border-border bg-surface py-2 pr-8 pl-9 text-base text-fg placeholder:text-fg-subtle focus:ring-2 focus:ring-accent focus:outline-none"
				aria-label="Search {scope}"
			/>
			{#if searchInput}
				<button
					type="button"
					onclick={clearSearch}
					aria-label="Clear search"
					class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-fg-subtle hover:text-fg"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if scope === 'albums'}
		{#if albumsQuery.isLoading && albumItems.length === 0}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each Array(10) as _, i (i)}
					<div class="aspect-square animate-pulse rounded-card bg-surface-raised"></div>
				{/each}
			</div>
		{:else if albumItems.length === 0}
			<EmptyState
				icon={Disc3}
				title={q ? 'No matching albums' : 'No albums yet'}
				description={q
					? 'Try a different search term.'
					: 'Albums will appear here once your library is set up.'}
			/>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each albumItems as album (album.id)}
					<div class="group relative">
						<a
							href={albumHref(album.musicbrainz_release_group_id ?? album.id)}
							aria-label="Open {album.title}"
						>
							<div
								class="aspect-square overflow-hidden rounded-card border border-border bg-surface-raised"
							>
								<AlbumImage
									mbid={album.id}
									source="local"
									available={album.cover_available}
									alt={album.title}
									size="full"
									requestSize={250}
									rounded="none"
									className="h-full w-full"
								/>
							</div>
							<p class="mt-2 line-clamp-1 text-sm font-semibold text-fg">{album.title}</p>
							<p class="line-clamp-1 text-xs text-fg-muted">{album.artist_name}</p>
						</a>
						<button
							type="button"
							onclick={() => void playAlbum(album)}
							aria-label="Play {album.title}"
							class="absolute right-2 bottom-14 grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
						>
							<Play class="h-4 w-4 fill-current" />
						</button>
						<div
							class="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
						>
							<ContextMenu items={albumMenuItems(album)} position="end" size="xs" />
						</div>
					</div>
				{/each}
			</div>
			{#if albumItems.length < albumTotal}
				<div class="flex justify-center pt-2">
					<button
						type="button"
						onclick={() => (albumPage += 1)}
						disabled={albumsQuery.isFetching}
						class="rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-hover"
					>
						{albumsQuery.isFetching
							? 'Loading…'
							: `Load more (${albumItems.length} / ${albumTotal})`}
					</button>
				</div>
			{/if}
		{/if}
	{:else if scope === 'artists'}
		{#if artistsQuery.isLoading && artistItems.length === 0}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each Array(10) as _, i (i)}
					<div class="aspect-square animate-pulse rounded-full bg-surface-raised"></div>
				{/each}
			</div>
		{:else if artistItems.length === 0}
			<EmptyState
				icon={Users}
				title={q ? 'No matching artists' : 'No artists yet'}
				description={q
					? 'Try a different search term.'
					: 'Artists will appear here once your library is set up.'}
			/>
		{:else}
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each artistItems as artist (artist.id)}
					<a
						href={artistHref(artist.musicbrainz_artist_id ?? artist.id)}
						aria-label="Open {artist.name}"
					>
						<div
							class="aspect-square overflow-hidden rounded-full border border-border bg-surface-raised"
						>
							<ArtistImage
								mbid={artist.id}
								source="local"
								alt={artist.name}
								size="full"
								requestSize={250}
								className="h-full w-full"
							/>
						</div>
						<p class="mt-2 line-clamp-1 text-center text-sm font-semibold text-fg">{artist.name}</p>
					</a>
				{/each}
			</div>
			{#if artistsQuery.hasNextPage}
				<div class="flex justify-center pt-2">
					<button
						type="button"
						onclick={() => artistsQuery.fetchNextPage()}
						disabled={artistsQuery.isFetchingNextPage}
						class="rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-hover"
					>
						{artistsQuery.isFetchingNextPage
							? 'Loading…'
							: `Load more (${artistItems.length} / ${artistTotal})`}
					</button>
				</div>
			{/if}
		{/if}
	{:else if scope === 'tracks'}
		{#if tracksQuery.isLoading && trackItems.length === 0}
			<div class="space-y-2">
				{#each Array(8) as _, i (i)}
					<div class="h-14 animate-pulse rounded-card bg-surface-raised"></div>
				{/each}
			</div>
		{:else if trackItems.length === 0}
			<EmptyState
				icon={Music2}
				title={q ? 'No matching tracks' : 'No tracks yet'}
				description={q
					? 'Try a different search term.'
					: 'Tracks will appear here once your library is set up.'}
			/>
		{:else}
			<div class="overflow-hidden rounded-card border border-border">
				{#each trackItems as track, i (track.id)}
					<div
						class="flex items-center gap-3 border-b border-border bg-surface px-3 py-2 last:border-b-0 hover:bg-surface-hover"
					>
						<button
							type="button"
							onclick={() => playTrack(i)}
							aria-label="Play {track.title}"
							class="group relative h-11 w-11 shrink-0 overflow-hidden rounded-control"
						>
							<AlbumImage
								mbid={track.album_id}
								source="local"
								available={track.cover_available}
								alt={track.album_title}
								size="full"
								requestSize={250}
								rounded="none"
								className="h-full w-full"
							/>
							<span
								class="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<Play class="h-4 w-4 fill-current text-white" />
							</span>
						</button>
						<div class="min-w-0 flex-1 text-left">
							<p class="truncate text-sm font-semibold text-fg">{track.title}</p>
							<p class="truncate text-xs text-fg-muted">
								{track.artist_name} · {track.album_title}
							</p>
						</div>
						{#if track.duration_seconds}
							<span class="shrink-0 text-xs text-fg-subtle"
								>{formatDurationSec(track.duration_seconds)}</span
							>
						{/if}
						<ContextMenu items={trackMenuItems(track)} position="end" size="xs" />
					</div>
				{/each}
			</div>
			{#if trackItems.length < trackTotal}
				<div class="flex justify-center pt-2">
					<button
						type="button"
						onclick={() => (trackOffset += TRACK_PAGE)}
						disabled={tracksQuery.isFetching}
						class="rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold text-fg hover:bg-surface-hover"
					>
						{tracksQuery.isFetching
							? 'Loading…'
							: `Load more (${trackItems.length} / ${trackTotal})`}
					</button>
				</div>
			{/if}
		{/if}
	{:else if followedQuery.isLoading}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each Array(6) as _, i (i)}
				<div class="aspect-square animate-pulse rounded-full bg-surface-raised"></div>
			{/each}
		</div>
	{:else if followedItems.length === 0}
		<EmptyState
			icon={Users}
			title={q ? 'No matching followed artists' : 'Not following anyone yet'}
			description="Follow artists from their page to see them here."
		/>
	{:else}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
			{#each followedItems as artist (artist.mbid)}
				<div class="group relative">
					<a href={artistHref(artist.mbid)} aria-label="Open {artist.name}">
						<div
							class="aspect-square overflow-hidden rounded-full border border-border bg-surface-raised"
						>
							<ArtistImage
								mbid={artist.mbid}
								alt={artist.name}
								size="full"
								requestSize={250}
								remoteUrl={artist.image_url ?? null}
								className="h-full w-full"
							/>
						</div>
						<p class="mt-2 line-clamp-1 text-center text-sm font-semibold text-fg">{artist.name}</p>
					</a>
					<button
						type="button"
						onclick={() => unfollow(artist)}
						aria-label="Unfollow {artist.name}"
						class="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-surface-overlay text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg"
					>
						<X class="h-3.5 w-3.5" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
