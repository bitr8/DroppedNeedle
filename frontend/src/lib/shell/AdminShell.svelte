<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fromStore } from 'svelte/store';
	import {
		ArrowUpCircle,
		Cog,
		Compass,
		Download,
		Heart,
		House,
		Inbox,
		LibraryBig,
		ListMusic,
		LogOut,
		Menu,
		PanelLeft,
		Search,
		Settings,
		ShieldCheck,
		UserRound,
		X
	} from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { integrationStore } from '$lib/stores/integration';
	import { playerStore } from '$lib/stores/player.svelte';
	import { syncStatus } from '$lib/stores/syncStatus.svelte';
	import { logout } from '$lib/utils/logout';
	import type { SuggestResult } from '$lib/types';
	import BatchDownloadIndicator from '$lib/components/BatchDownloadIndicator.svelte';
	import CacheSyncIndicator from '$lib/components/CacheSyncIndicator.svelte';
	import ConcertsNavBadge from '$lib/components/ConcertsNavBadge.svelte';
	import DegradedBanner from '$lib/components/DegradedBanner.svelte';
	import DownloadsNavBadge from '$lib/components/DownloadsNavBadge.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LibraryActivityStrip from '$lib/components/library/LibraryActivityStrip.svelte';
	import NewReleasesNavBadge from '$lib/components/NewReleasesNavBadge.svelte';
	import PendingApprovalNavBadge from '$lib/components/PendingApprovalNavBadge.svelte';
	import SearchSuggestions from '$lib/components/SearchSuggestions.svelte';
	import ServiceHealthIndicator from '$lib/components/ServiceHealthIndicator.svelte';
	import SidebarServices from '$lib/components/SidebarServices.svelte';
	import VersionOverlays from '$lib/components/VersionOverlays.svelte';

	let { children }: { children: Snippet } = $props();

	let query = $state('');
	let modalQuery = $state('');
	let versionUpdateAvailable = $state(false);

	const integrations = fromStore(integrationStore);
	const downloadClientConfigured = $derived(
		integrations.current.download_client || !integrations.current.loaded
	);

	const currentPath = $derived(page.url.pathname);
	function isNavActive(path: string): boolean {
		return currentPath === path || currentPath.startsWith(`${path}/`);
	}
	const libraryNavActive = $derived(isNavActive('/library') && !isNavActive('/library/management'));
	const settingsHref = $derived(versionUpdateAvailable ? '/settings?tab=about' : '/settings');
	const settingsLabel = $derived(
		versionUpdateAvailable ? 'Settings - update available' : 'Settings'
	);

	const searchModal = () => document.getElementById('search_modal') as HTMLDialogElement | null;

	function handleSearch() {
		if (query.trim()) goto(`/search?q=${encodeURIComponent(query)}`);
	}

	function handleModalSearch() {
		if (!modalQuery.trim()) return;
		goto(`/search?q=${encodeURIComponent(modalQuery)}`);
		searchModal()?.close();
		modalQuery = '';
	}

	function handleSuggestionSelect(result: SuggestResult) {
		const routeId = result.type === 'artist' ? '/artist/[id]' : '/album/[id]';
		goto(resolve(routeId, { id: result.musicbrainz_id }));
	}

	function handleModalSuggestionSelect(result: SuggestResult) {
		searchModal()?.close();
		handleSuggestionSelect(result);
	}
</script>

<DegradedBanner />
<VersionOverlays bind:updateAvailable={versionUpdateAvailable} />

<div class="drawer md:drawer-open">
	<input id="main-drawer" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex min-w-0 flex-col isolate">
		<div
			class="droppedneedle-topbar navbar bg-base-100/95 backdrop-blur shadow-sm sticky top-0 z-50"
		>
			<div class="navbar-start w-auto">
				<a href="/" class="btn btn-ghost px-2 max-xs:hidden sm:px-4" aria-label="Home">
					<img src="/logo_wide.png" alt="DroppedNeedle" class="h-8 hidden sm:block" />
					<img src="/logo_icon.png" alt="DroppedNeedle" class="h-8 block sm:hidden" />
				</a>
			</div>
			<div class="navbar-center min-w-0 grow justify-center px-1 sm:px-4">
				<div class="w-full max-w-2xl">
					<SearchSuggestions
						bind:query
						onSearch={handleSearch}
						onSelect={handleSuggestionSelect}
						id="navbar-suggest"
					/>
				</div>
			</div>
			<div class="navbar-end w-auto pr-1 sm:pr-2">
				<ServiceHealthIndicator />
				<a href="/profile" class="btn btn-ghost btn-circle btn-md" aria-label="Profile">
					{#if authStore.user?.avatar_url}
						<img
							src={authStore.user.avatar_url}
							alt="Profile"
							class="h-7 w-7 rounded-full object-cover"
						/>
					{:else}
						<UserRound class="h-6 w-6" />
					{/if}
				</a>
			</div>
		</div>

		<LibraryActivityStrip />

		<div
			class="droppedneedle-main-content flex-1"
			class:droppedneedle-player-visible={playerStore.isPlayerVisible}
		>
			{@render children()}
			<Footer />
		</div>
	</div>

	<div class="drawer-side hidden md:block is-drawer-close:overflow-visible">
		<label for="main-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
		<div
			class="is-drawer-close:w-16 is-drawer-open:w-64 bg-base-200 flex flex-col items-start min-h-full"
		>
			<ul class="menu w-full grow p-2 [&_li>*]:py-3">
				<li>
					<button
						onclick={() => searchModal()?.showModal()}
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						data-tip="Search"
					>
						<Search class="h-6 w-6" />
						<span class="is-drawer-close:hidden">Search</span>
					</button>
				</li>

				<div class="divider my-0"></div>

				<li>
					<a href="/" class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Home">
						<House class="h-6 w-6" />
						<span class="is-drawer-close:hidden">Home</span>
					</a>
				</li>

				<li>
					<a
						href="/discover"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						data-tip="Discover"
					>
						<Compass class="h-6 w-6" />
						<span class="is-drawer-close:hidden">Discover</span>
					</a>
				</li>

				<li>
					<a
						href="/library"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						class:menu-active={libraryNavActive}
						aria-current={libraryNavActive ? 'page' : undefined}
						data-tip="Library"
					>
						<div class="relative">
							<Menu class="h-6 w-6" />
							{#if syncStatus.isActive}
								<span
									class="absolute -top-1 -right-1 badge badge-primary badge-xs w-2.5 h-2.5 p-0 animate-pulse"
									aria-label="Library sync in progress"
								></span>
							{/if}
						</div>
						<span class="is-drawer-close:hidden">Library</span>
					</a>
				</li>

				<li>
					<a
						href="/downloads"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						data-tip="Downloads"
					>
						<div class="relative">
							<Download class="h-6 w-6" />
							<DownloadsNavBadge />
						</div>
						<span class="is-drawer-close:hidden">Downloads</span>
					</a>
				</li>

				<li>
					<a
						href="/following"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						class:menu-active={isNavActive('/following')}
						aria-current={isNavActive('/following') ? 'page' : undefined}
						data-tip="Following"
					>
						<div class="relative">
							<Heart class="h-6 w-6" />
							<ConcertsNavBadge />
							<NewReleasesNavBadge />
						</div>
						<span class="is-drawer-close:hidden">Following</span>
					</a>
				</li>

				<li>
					<a
						href="/playlists"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						class:menu-active={isNavActive('/playlists')}
						aria-current={isNavActive('/playlists') ? 'page' : undefined}
						data-tip="Playlists"
					>
						<ListMusic class="h-6 w-6" />
						<span class="is-drawer-close:hidden">Playlists</span>
					</a>
				</li>

				<SidebarServices />

				{#if downloadClientConfigured}
					<div class="divider my-0"></div>
					<li>
						<a
							href="/requests"
							class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
							data-tip="Requests"
						>
							<Inbox class="h-6 w-6" />
							<span class="is-drawer-close:hidden">Requests</span>
						</a>
					</li>
				{/if}

				<div class="divider my-0"></div>
				<li class="menu-title is-drawer-close:hidden px-3 pb-1 pt-2">
					<span class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-base-content/40"
						>Admin</span
					>
				</li>
				<li>
					<a
						href="/library/management"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						class:menu-active={isNavActive('/library/management')}
						aria-current={isNavActive('/library/management') ? 'page' : undefined}
						aria-label="Library Management"
						data-tip="Library Management"
					>
						<div class="relative h-6 w-6">
							<LibraryBig class="h-6 w-6" />
							<span
								class="absolute -bottom-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-base-200 text-library-manage"
							>
								<Cog class="h-3 w-3" />
							</span>
						</div>
						<span class="is-drawer-close:hidden">Library Management</span>
					</a>
				</li>
				<li>
					<a
						href="/requests?tab=approvals"
						class="is-drawer-close:tooltip is-drawer-close:tooltip-right"
						data-tip="Approvals"
					>
						<div class="relative">
							<ShieldCheck class="h-6 w-6" />
							<PendingApprovalNavBadge />
						</div>
						<span class="is-drawer-close:hidden">Approvals</span>
					</a>
				</li>
			</ul>
			<div class="w-full p-2 flex flex-col gap-1" class:pb-24={playerStore.isPlayerVisible}>
				<div class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip={settingsLabel}>
					<a
						href={settingsHref}
						class="btn btn-ghost btn-circle relative"
						aria-label={settingsLabel}
					>
						<Settings class="h-6 w-6" />
						{#if versionUpdateAvailable}
							<span
								class="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent text-accent-content shadow-sm shadow-accent/30"
							>
								<ArrowUpCircle class="h-3 w-3" />
							</span>
						{/if}
					</a>
				</div>
				<div class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Log out">
					<button
						onclick={() => void logout()}
						class="btn btn-ghost btn-circle"
						aria-label="Log out"
					>
						<LogOut class="h-6 w-6" />
					</button>
				</div>
				<div class="is-drawer-close:tooltip is-drawer-close:tooltip-right" data-tip="Open">
					<label
						for="main-drawer"
						class="btn btn-ghost btn-circle drawer-button is-drawer-open:rotate-y-180"
					>
						<PanelLeft class="h-6 w-6" />
					</label>
				</div>
			</div>
		</div>
	</div>
</div>

<nav class="droppedneedle-bottom-nav md:hidden" aria-label="Primary navigation">
	<a
		href="/"
		class="droppedneedle-bottom-nav__item"
		class:active={currentPath === '/'}
		aria-current={currentPath === '/' ? 'page' : undefined}
	>
		<House />
		<span>Home</span>
	</a>
	<a
		href="/discover"
		class="droppedneedle-bottom-nav__item"
		class:active={isNavActive('/discover')}
		aria-current={isNavActive('/discover') ? 'page' : undefined}
	>
		<Compass />
		<span>Discover</span>
	</a>
	<button
		type="button"
		class="droppedneedle-bottom-nav__item"
		class:active={isNavActive('/search')}
		onclick={() => searchModal()?.showModal()}
		aria-current={isNavActive('/search') ? 'page' : undefined}
	>
		<Search />
		<span>Search</span>
	</button>
	<a
		href="/library"
		class="droppedneedle-bottom-nav__item"
		class:active={isNavActive('/library')}
		aria-current={isNavActive('/library') ? 'page' : undefined}
	>
		<Menu />
		<span>Library</span>
		{#if syncStatus.isActive}
			<span class="droppedneedle-bottom-nav__badge" aria-label="Library sync in progress"></span>
		{/if}
	</a>
	<a
		href={settingsHref}
		class="droppedneedle-bottom-nav__item"
		class:active={isNavActive('/settings')}
		aria-current={isNavActive('/settings') ? 'page' : undefined}
	>
		<Settings />
		<span>Settings</span>
		{#if versionUpdateAvailable}
			<span class="droppedneedle-bottom-nav__badge" aria-label="Update available">
				<ArrowUpCircle class="h-3 w-3" />
			</span>
		{/if}
	</a>
</nav>

<dialog id="search_modal" class="modal">
	<div class="modal-box overflow-visible">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" aria-label="Close"
				><X class="h-4 w-4" /></button
			>
		</form>
		<h3 class="font-bold text-lg mb-4">Search</h3>
		<SearchSuggestions
			bind:query={modalQuery}
			onSearch={handleModalSearch}
			onSelect={handleModalSuggestionSelect}
			placeholder="Search albums or artists..."
			autofocus={true}
			id="modal-suggest"
		/>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close modal">close</button>
	</form>
</dialog>

<CacheSyncIndicator />
<BatchDownloadIndicator />
