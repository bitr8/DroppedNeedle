<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AlbumCard from '$lib/components/AlbumCard.svelte';
	import AlbumImage from '$lib/components/AlbumImage.svelte';
	import AlbumRequestButton from '$lib/components/AlbumRequestButton.svelte';
	import SearchArtistCard from '$lib/components/SearchArtistCard.svelte';
	import SearchSuggestions from '$lib/components/SearchSuggestions.svelte';
	import ViewMoreAlbumCard from '$lib/components/ViewMoreAlbumCard.svelte';
	import ViewMoreArtistCard from '$lib/components/ViewMoreArtistCard.svelte';
	import ArtistCardSkeleton from '$lib/components/ArtistCardSkeleton.svelte';
	import AlbumCardSkeleton from '$lib/components/AlbumCardSkeleton.svelte';
	import type {
		Album,
		EnrichmentResponse,
		EnrichmentSource,
		SearchRemoteStatus,
		SuggestResult
	} from '$lib/types';
	import { colors } from '$lib/colors';
	import { albumHref } from '$lib/utils/entityRoutes';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { libraryStore } from '$lib/stores/library';
	import { searchStore } from '$lib/stores/search';
	import {
		fetchEnrichmentBatch,
		applyArtistEnrichment,
		applyAlbumEnrichment
	} from '$lib/utils/enrichment';
	import { createSearchEnrichmentBatcher } from '$lib/utils/searchEnrichmentBatcher';
	import {
		getLocalAlbumSearchQuery,
		getLocalArtistSearchQuery,
		getRemoteAlbumSearchQuery,
		getRemoteArtistSearchQuery,
		mergeSearchAlbums,
		mergeSearchArtists
	} from '$lib/queries/search/SearchQueries.svelte';
	import { Check, ArrowRight, RefreshCw } from 'lucide-svelte';
	import SearchTopResult from '$lib/components/SearchTopResult.svelte';

	interface Props {
		data: { query: string };
	}

	let { data }: Props = $props();

	let showToast = $state(false);
	let enrichmentSource: EnrichmentSource = $state('none');
	let enrichment: EnrichmentResponse | null = $state(null);
	let enrichmentQuery = $state('');

	let normalizedQuery = $derived(data.query.trim());
	const localArtistQuery = getLocalArtistSearchQuery(() => normalizedQuery);
	const localAlbumQuery = getLocalAlbumSearchQuery(() => normalizedQuery);
	const artistQuery = getRemoteArtistSearchQuery(() => normalizedQuery);
	const albumQuery = getRemoteAlbumSearchQuery(() => normalizedQuery);

	let baseArtists = $derived(
		mergeSearchArtists(localArtistQuery.data?.items ?? [], artistQuery.data?.results ?? [])
	);
	let baseAlbums = $derived(
		mergeSearchAlbums(localAlbumQuery.data?.items ?? [], albumQuery.data?.results ?? [])
	);
	let artists = $derived(enrichment ? applyArtistEnrichment(baseArtists, enrichment) : baseArtists);
	let albums = $derived(enrichment ? applyAlbumEnrichment(baseAlbums, enrichment) : baseAlbums);
	let topArtist = $derived(
		artists.find(
			(artist) => artist.musicbrainz_id === artistQuery.data?.top_result?.musicbrainz_id
		) ?? null
	);
	let topAlbum = $derived(
		albums.find((album) => album.musicbrainz_id === albumQuery.data?.top_result?.musicbrainz_id) ??
			null
	);
	let artistStatus: SearchRemoteStatus = $derived(
		artistQuery.isError ? 'error' : (artistQuery.data?.status ?? 'ok')
	);
	let albumStatus: SearchRemoteStatus = $derived(
		albumQuery.isError ? 'error' : (albumQuery.data?.status ?? 'ok')
	);
	let loadingArtists = $derived(
		(artistQuery.isPending || localArtistQuery.isPending) && artists.length === 0
	);
	let loadingAlbums = $derived(
		(albumQuery.isPending || localAlbumQuery.isPending) && albums.length === 0
	);
	let hasSearched = $derived(normalizedQuery.length >= 2);

	let isSearching = $derived(
		localArtistQuery.isFetching ||
			localAlbumQuery.isFetching ||
			artistQuery.isFetching ||
			albumQuery.isFetching
	);
	let hasTopResult = $derived(topArtist != null || topAlbum != null);
	let displayedArtists = $derived(
		topArtist ? artists.filter((a) => a.musicbrainz_id !== topArtist?.musicbrainz_id) : artists
	);
	let artistCards = $derived(displayedArtists.slice(0, 5));
	let artistPlaceholderCount = $derived(
		artistQuery.isFetching ? Math.max(0, 5 - artistCards.length) : 0
	);
	let displayedAlbums = $derived(
		topAlbum ? albums.filter((a) => a.musicbrainz_id !== topAlbum?.musicbrainz_id) : albums
	);

	function isAlbumInLibrary(album: Album): boolean {
		return (
			libraryStore.isInLibrary(album.musicbrainz_id) ||
			(!$libraryStore.initialized && album.in_library) ||
			false
		);
	}
	function isAlbumRequested(album: Album): boolean {
		return (
			!isAlbumInLibrary(album) &&
			(album.requested || libraryStore.isRequested(album.musicbrainz_id))
		);
	}
	let libraryAlbums = $derived(displayedAlbums.filter((album) => isAlbumInLibrary(album)));
	let requestableAlbums = $derived(displayedAlbums.filter((album) => !isAlbumInLibrary(album)));

	const RECENT_SEARCHES_LIMIT = 8;
	function recentSearchesKey(): string {
		return `dn:recent_searches:${authStore.user?.id ?? 'anon'}`;
	}
	function loadRecentSearches(): string[] {
		try {
			const raw = localStorage.getItem(recentSearchesKey());
			return raw ? (JSON.parse(raw) as string[]) : [];
		} catch {
			return [];
		}
	}
	function saveRecentSearch(query: string) {
		const trimmed = query.trim();
		if (!trimmed) return;
		try {
			const deduped = loadRecentSearches().filter(
				(item) => item.toLowerCase() !== trimmed.toLowerCase()
			);
			recentSearches = [trimmed, ...deduped].slice(0, RECENT_SEARCHES_LIMIT);
			localStorage.setItem(recentSearchesKey(), JSON.stringify(recentSearches));
		} catch {
			// localStorage unavailable (private browsing, quota) — recent searches just won't persist
		}
	}

	let heroQuery = $derived(data.query);
	let recentSearches = $state<string[]>([]);

	$effect(() => {
		if (!hasSearched) recentSearches = loadRecentSearches();
	});

	function handleHeroSearch() {
		const trimmed = heroQuery.trim();
		if (!trimmed) return;
		saveRecentSearch(trimmed);
		goto(`/search?q=${encodeURIComponent(trimmed)}`);
	}

	function handleHeroSelect(result: SuggestResult) {
		saveRecentSearch(heroQuery.trim() || result.title);
		const routeId = result.type === 'artist' ? '/artist/[id]' : '/album/[id]';
		goto(resolve(routeId, { id: result.musicbrainz_id }));
	}

	function handleRecentSearch(query: string) {
		goto(`/search?q=${encodeURIComponent(query)}`);
	}

	function navigateToBucket(bucket: 'artists' | 'albums') {
		if (data.query) {
			goto(`/search/${bucket}?q=${encodeURIComponent(data.query)}`);
		}
	}

	function handleAlbumAdded() {
		showToast = true;
		setTimeout(() => {
			showToast = false;
		}, 3000);
	}

	const enrichmentBatcher = createSearchEnrichmentBatcher({
		load: fetchEnrichmentBatch,
		onresult: (result) => {
			enrichmentSource = result.source;
			enrichment = result;
			searchStore.setEnrichmentSource(enrichmentSource);
		}
	});

	$effect(() => {
		if (normalizedQuery === enrichmentQuery) return;
		enrichmentQuery = normalizedQuery;
		enrichmentBatcher.reset();
		enrichment = null;
		enrichmentSource = 'none';
	});

	$effect(() => {
		const handleRefresh = () => {
			void Promise.all([
				localArtistQuery.refetch(),
				localAlbumQuery.refetch(),
				artistQuery.refetch(),
				albumQuery.refetch()
			]);
		};
		window.addEventListener('search-refresh', handleRefresh);
		return () => window.removeEventListener('search-refresh', handleRefresh);
	});

	onDestroy(() => {
		enrichmentBatcher.dispose();
	});

	function statusMessage(status: SearchRemoteStatus, bucket: 'artists' | 'albums'): string {
		if (status === 'timeout') return `MusicBrainz ${bucket} took too long to respond.`;
		if (status === 'partial') return `Some MusicBrainz ${bucket} could not be loaded.`;
		return `MusicBrainz ${bucket} are temporarily unavailable.`;
	}
</script>

{#if hasSearched || isSearching}
	<div class="px-4 sm:px-8 pt-4">
		<SearchSuggestions
			bind:query={heroQuery}
			onSearch={handleHeroSearch}
			onSelect={handleHeroSelect}
			placeholder="Search artists, albums…"
			id="search-results-field"
		/>
	</div>
	<div class="px-8 pt-4 pb-2">
		<div class="flex gap-2">
			<button
				class="badge badge-lg cursor-pointer"
				style="background-color: {colors.primary}; color: {colors.secondary};"
			>
				All
			</button>
			<button
				class="badge badge-lg cursor-pointer transition-colors"
				style="background-color: {colors.secondary}; color: {colors.primary};"
				onclick={() => navigateToBucket('artists')}
			>
				Artists
			</button>
			<button
				class="badge badge-lg cursor-pointer transition-colors"
				style="background-color: {colors.secondary}; color: {colors.primary};"
				onclick={() => navigateToBucket('albums')}
			>
				Albums
			</button>
		</div>
	</div>
{/if}

{#if hasSearched}
	<section class="px-8 py-4 space-y-8">
		{#if isSearching}
			<div
				class="grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:overflow-visible"
				aria-label="Loading top search results"
			>
				<div class="skeleton skeleton-shimmer min-h-44 sm:min-h-56 rounded-box"></div>
				<div class="skeleton skeleton-shimmer min-h-44 sm:min-h-56 rounded-box"></div>
			</div>
		{:else if hasTopResult}
			<div
				class="grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:overflow-visible"
			>
				{#if topArtist}
					<SearchTopResult artist={topArtist} />
				{/if}
				{#if topAlbum}
					<SearchTopResult album={topAlbum} />
				{/if}
			</div>
		{/if}

		<div>
			<h2 class="text-xl font-bold mb-4">Artists</h2>
			{#if artistStatus !== 'ok'}
				<div class="alert alert-warning mb-3" role="status">
					<span
						>{statusMessage(artistStatus, 'artists')} Local and cached results remain available.</span
					>
					<button class="btn btn-sm" onclick={() => artistQuery.refetch()}>
						<RefreshCw class="h-4 w-4" /> Retry
					</button>
				</div>
			{/if}
			{#if loadingArtists}
				<div class="bg-base-200 rounded-box p-4">
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
					>
						{#each Array(6) as _, i (`artist-skeleton-${i}`)}
							<ArtistCardSkeleton variant="detailed" />
						{/each}
					</div>
				</div>
			{:else if displayedArtists.length > 0}
				<div class="bg-base-200 rounded-box p-4 overflow-hidden">
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
						aria-label="Artist search results"
						aria-busy={artistQuery.isFetching}
					>
						<ViewMoreArtistCard />
						{#each artistCards as artist (artist.musicbrainz_id)}
							<SearchArtistCard
								{artist}
								{enrichmentSource}
								onenrichmentrequest={() => enrichmentBatcher.requestArtist(artist)}
							/>
						{/each}
						{#each Array(artistPlaceholderCount) as _, i (`artist-pending-${i}`)}
							<ArtistCardSkeleton variant="detailed" />
						{/each}
					</div>
				</div>
			{:else}
				<div class="p-8 bg-base-200 rounded-box text-center text-gray-500">No artists found</div>
			{/if}
		</div>

		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold">Albums</h2>
				{#if displayedAlbums.length > 0}
					<a
						href={`/search/albums?q=${encodeURIComponent(data.query)}`}
						class="text-sm text-primary hover:underline"
					>
						View more <ArrowRight class="h-4 w-4 inline align-middle" />
					</a>
				{/if}
			</div>
			{#if albumStatus !== 'ok'}
				<div class="alert alert-warning mb-3" role="status">
					<span
						>{statusMessage(albumStatus, 'albums')} Local and cached results remain available.</span
					>
					<button class="btn btn-sm" onclick={() => albumQuery.refetch()}>
						<RefreshCw class="h-4 w-4" /> Retry
					</button>
				</div>
			{/if}
			{#if loadingAlbums}
				<div class="bg-base-200 rounded-box p-4">
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
					>
						{#each Array(6) as _, i (`album-skeleton-${i}`)}
							<AlbumCardSkeleton />
						{/each}
					</div>
				</div>
			{:else if displayedAlbums.length > 0 && authStore.isAdmin}
				<div class="bg-base-200 rounded-box p-4">
					<div
						class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
					>
						<ViewMoreAlbumCard />
						{#each displayedAlbums as album (album.musicbrainz_id)}
							<AlbumCard
								{album}
								{enrichmentSource}
								onadded={handleAlbumAdded}
								onenrichmentrequest={() => enrichmentBatcher.requestAlbum(album)}
							/>
						{/each}
					</div>
				</div>
			{:else if displayedAlbums.length > 0}
				<div class="space-y-6">
					<div>
						<h3 class="mb-2 text-base font-semibold text-fg-muted">In your library</h3>
						{#if libraryAlbums.length > 0}
							<div
								class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
							>
								{#each libraryAlbums as album (album.musicbrainz_id)}
									<AlbumCard
										{album}
										{enrichmentSource}
										onenrichmentrequest={() => enrichmentBatcher.requestAlbum(album)}
									/>
								{/each}
							</div>
						{:else}
							<p class="rounded-card border border-border bg-surface p-4 text-base text-fg-subtle">
								None of these are in your library yet.
							</p>
						{/if}
					</div>
					<div>
						<h3 class="mb-2 text-base font-semibold text-fg-muted">Not in library — Request</h3>
						{#if requestableAlbums.length > 0}
							<div class="space-y-2">
								{#each requestableAlbums as album (album.musicbrainz_id)}
									<div
										class="flex items-center gap-3 rounded-card border border-border bg-surface p-2"
									>
										<a
											href={albumHref(album.musicbrainz_id)}
											class="flex min-w-0 flex-1 items-center gap-3"
										>
											<AlbumImage
												mbid={album.local_id ?? album.musicbrainz_id}
												customUrl={album.cover_url}
												remoteUrl={album.album_thumb_url ?? null}
												alt={album.title}
												size="sm"
												className="size-12 shrink-0"
											/>
											<div class="min-w-0">
												<div class="truncate text-base font-medium text-fg">{album.title}</div>
												<div class="truncate text-sm text-fg-muted">
													{#if album.artist}{album.artist}{/if}
													{#if album.year}&middot; {album.year}{/if}
												</div>
											</div>
										</a>
										{#if isAlbumRequested(album)}
											<span class="shrink-0 px-2 text-sm text-fg-subtle">Requested</span>
										{:else}
											<AlbumRequestButton
												mbid={album.musicbrainz_id}
												artistName={album.artist ?? ''}
												albumName={album.title}
												year={album.year}
											/>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<p class="rounded-card border border-border bg-surface p-4 text-base text-fg-subtle">
								Everything found is already in your library.
							</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="p-8 bg-base-200 rounded-box text-center text-gray-500">No albums found</div>
			{/if}
		</div>
	</section>
{:else}
	<div class="mx-auto max-w-xl px-4 pt-16 pb-8 sm:pt-24">
		<h1 class="mb-6 text-center text-2xl font-bold text-fg">Search</h1>
		<SearchSuggestions
			bind:query={heroQuery}
			onSearch={handleHeroSearch}
			onSelect={handleHeroSelect}
			placeholder="Search artists, albums…"
			autofocus
			id="search-hero-field"
		/>
		<p class="mt-3 text-center text-base text-fg-subtle">
			Search your library and MusicBrainz for anything to play or request.
		</p>

		{#if recentSearches.length > 0}
			<div class="mt-8">
				<h2 class="mb-2 text-sm font-semibold text-fg-muted">Recent searches</h2>
				<div class="flex flex-wrap gap-2">
					{#each recentSearches as recent (recent)}
						<button
							type="button"
							class="rounded-control border border-border bg-surface-raised px-3 py-2.5 text-base text-fg hover:bg-surface-hover"
							onclick={() => handleRecentSearch(recent)}
						>
							{recent}
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

{#if showToast}
	<div class="toast toast-end toast-bottom">
		<div class="alert alert-success">
			<Check class="h-6 w-6" />
			<span>Added to Library</span>
		</div>
	</div>
{/if}
