<script lang="ts">
	import HomeSectionNowPlaying from '$lib/components/HomeSectionNowPlaying.svelte';
	import HomeSection from '$lib/components/HomeSection.svelte';
	import WeeklyExploration from '$lib/components/WeeklyExploration.svelte';
	import GenreGrid from '$lib/components/GenreGrid.svelte';
	import DiscoverTeaserBand from '$lib/components/discover/DiscoverTeaserBand.svelte';
	import { getHomeQuery } from '$lib/queries/HomeQuery.svelte';
	import { getRecentReleasesQuery } from '$lib/queries/following/FollowQueries.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { getGreeting } from '$lib/utils/homeCache';
	import type { HomeSection as HomeSectionType } from '$lib/types';

	const homeQuery = getHomeQuery();
	const homeData = $derived(homeQuery.data);
	const loading = $derived(homeQuery.isLoading);

	const newReleasesQuery = getRecentReleasesQuery(
		() => 30,
		() => 12
	);

	const newReleasesSection = $derived<HomeSectionType | null>(
		newReleasesQuery.data?.items.length
			? {
					title: 'New from artists you follow',
					type: 'albums',
					items: newReleasesQuery.data.items.map((release) => ({
						mbid: release.release_group_mbid,
						name: release.title,
						artist_name: release.artist_name,
						artist_mbid: release.artist_mbid,
						image_url: null,
						release_date: release.first_release_date ?? null,
						listen_count: null,
						in_library: release.in_library ?? false
					})),
					source: null,
					fallback_message: null,
					connect_service: null
				}
			: null
	);

	const recentsSection = $derived(
		homeData?.recently_played?.items.length
			? homeData.recently_played
			: (homeData?.recently_added ?? null)
	);

	const hasContent = $derived(
		!!recentsSection ||
			!!newReleasesSection ||
			!!(homeData?.weekly_exploration && homeData.weekly_exploration.tracks.length > 0) ||
			!!(homeData?.genre_list && homeData.genre_list.items.length > 0)
	);
</script>

<svelte:head>
	<title>Home - DroppedNeedle</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
	<h1 class="text-2xl font-bold text-fg">
		{getGreeting()}{authStore.user?.display_name ? `, ${authStore.user.display_name}` : ''}
	</h1>

	<HomeSectionNowPlaying />

	{#if recentsSection}
		<HomeSection section={recentsSection} />
	{/if}

	<DiscoverTeaserBand preview={homeData?.discover_preview ?? null} />

	{#if newReleasesSection}
		<HomeSection section={newReleasesSection} headerLink="/following/new-releases" />
	{/if}

	{#if homeData?.weekly_exploration && homeData.weekly_exploration.tracks.length > 0}
		<WeeklyExploration section={homeData.weekly_exploration} />
	{/if}

	{#if homeData?.genre_list && homeData.genre_list.items.length > 0}
		<GenreGrid
			title={homeData.genre_list.title}
			genres={homeData.genre_list.items}
			genreArtwork={homeData.genre_artwork}
		/>
	{/if}

	{#if !loading && !hasContent}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-fg-muted">Your library is being prepared. Check back soon.</p>
		</div>
	{/if}
</div>
