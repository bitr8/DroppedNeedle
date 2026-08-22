<script lang="ts">
	import type { Component, ComponentType } from 'svelte';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { SvelteURL } from 'svelte/reactivity';
	import { fromStore } from 'svelte/store';
	import { integrationStore } from '$lib/stores/integration';
	import SettingsTabContent from '$lib/components/settings/SettingsTabContent.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { getUpdateCheckQuery } from '$lib/queries/VersionQuery.svelte';
	import {
		settingsPages,
		legacyTabMap,
		DEFAULT_SETTINGS_PAGE,
		resolvePage
	} from '$lib/components/settings/settingsPages';
	import { ArrowUpCircle, Youtube, Globe, HardDrive, HardDriveDownload } from 'lucide-svelte';
	import JellyfinIcon from '$lib/components/JellyfinIcon.svelte';
	import NavidromeIcon from '$lib/components/NavidromeIcon.svelte';
	import PlexIcon from '$lib/components/PlexIcon.svelte';
	import SpotifyIcon from '$lib/components/SpotifyIcon.svelte';

	const integration = fromStore(integrationStore);
	const updateCheckQuery = getUpdateCheckQuery();
	const updateAvailable = $derived(updateCheckQuery.data?.update_available ?? false);

	interface ConnectedSource {
		id: string;
		label: string;
		icon: Component<{ class?: string }> | ComponentType;
		page: string;
		anchor: string;
		connected: boolean | null;
	}

	const connectedSources = $derived<ConnectedSource[]>([
		{
			id: 'plex',
			label: 'Plex',
			icon: PlexIcon,
			page: 'integrations',
			anchor: 'plex',
			connected: integration.current.plex
		},
		{
			id: 'navidrome',
			label: 'Navidrome',
			icon: NavidromeIcon,
			page: 'integrations',
			anchor: 'navidrome',
			connected: integration.current.navidrome
		},
		{
			id: 'jellyfin',
			label: 'Jellyfin',
			icon: JellyfinIcon,
			page: 'integrations',
			anchor: 'jellyfin',
			connected: integration.current.jellyfin
		},
		{
			id: 'youtube',
			label: 'YouTube',
			icon: Youtube,
			page: 'integrations',
			anchor: 'youtube',
			connected: integration.current.youtube
		},
		{
			id: 'localfiles',
			label: 'Local files',
			icon: HardDrive,
			page: 'library',
			anchor: 'library',
			connected: integration.current.localfiles
		},
		{
			id: 'download-client',
			label: 'Download client',
			icon: HardDriveDownload,
			page: 'downloads',
			anchor: 'download-client',
			connected: integration.current.download_client
		},
		{
			id: 'musicbrainz',
			label: 'MusicBrainz',
			icon: Globe,
			page: 'library',
			anchor: 'musicbrainz',
			connected: null
		},
		{
			id: 'spotify',
			label: 'Spotify',
			icon: SpotifyIcon,
			page: 'integrations',
			anchor: 'spotify',
			connected: null
		}
	]);

	function initialPageId(): string {
		const pageParam = page.url.searchParams.get('page');
		if (pageParam && settingsPages.some((p) => p.id === pageParam)) return pageParam;
		const tabParam = page.url.searchParams.get('tab');
		if (tabParam) {
			const mapped = legacyTabMap[tabParam];
			if (mapped && mapped !== 'profile') return mapped.page;
		}
		return DEFAULT_SETTINGS_PAGE;
	}

	let activePageId = $state(initialPageId());
	const activePage = $derived(resolvePage(activePageId));

	function scrollToAnchor(anchor: string) {
		void tick().then(() => {
			document.getElementById(`section-${anchor}`)?.scrollIntoView({ block: 'start' });
		});
	}

	function selectPage(id: string, anchor?: string) {
		activePageId = id;
		const url = new SvelteURL(page.url);
		url.searchParams.delete('tab');
		url.searchParams.set('page', id);
		url.hash = '';
		replaceState(url, {});
		if (anchor) scrollToAnchor(anchor);
	}

	function handleMobileSelect(event: Event) {
		selectPage((event.target as HTMLSelectElement).value);
	}

	onMount(() => {
		integrationStore.ensureLoaded();

		const tabParam = page.url.searchParams.get('tab');
		if (tabParam) {
			const mapped = legacyTabMap[tabParam];
			if (mapped === 'profile') {
				goto('/profile', { replaceState: true });
				return;
			}
			if (mapped) {
				selectPage(mapped.page, mapped.anchor);
				return;
			}
		}
		const hash = page.url.hash?.slice(1);
		if (hash) scrollToAnchor(hash);
	});
</script>

<div class="min-h-screen bg-surface">
	<div class="container mx-auto max-w-7xl p-4 lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col">
		<div class="mb-6 lg:shrink-0">
			<h1 class="text-3xl font-bold text-fg">Settings</h1>
			<p class="mt-2 text-fg-muted">Manage your preferences and app settings.</p>
		</div>

		<div class="mb-4 lg:hidden">
			<label class="sr-only" for="settings-page-select">Settings page</label>
			<select
				id="settings-page-select"
				class="w-full rounded-control border border-border bg-surface-raised px-3 py-2 text-fg"
				value={activePageId}
				onchange={handleMobileSelect}
			>
				{#each settingsPages as p (p.id)}
					<option value={p.id}>{p.label}</option>
				{/each}
			</select>
			<a href="/profile" class="mt-2 inline-block text-sm text-fg-subtle hover:text-accent">
				Looking for Home/Discover/Sidebar preferences? They live in your profile →
			</a>
		</div>

		<div class="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:flex-row">
			<aside class="hidden w-64 shrink-0 lg:block lg:overflow-y-auto lg:pb-4">
				<nav class="space-y-1">
					{#each settingsPages as p (p.id)}
						{@const Icon = p.icon}
						{@const isActive = activePageId === p.id}
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors {isActive
								? 'bg-accent/15 font-semibold text-accent'
								: 'text-fg-muted hover:bg-surface-hover hover:text-fg'}"
							onclick={() => selectPage(p.id)}
						>
							<Icon class="h-4 w-4 shrink-0" />
							<span>{p.label}</span>
							{#if p.id === 'about' && updateAvailable}
								<span
									class="ml-auto flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent"
								>
									<ArrowUpCircle class="h-3 w-3" />
									Update
								</span>
							{/if}
						</button>
					{/each}
				</nav>
				<a
					href="/profile"
					class="mt-4 block rounded-control px-3 py-2 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
				>
					Home/Discover/Sidebar preferences moved to your profile →
				</a>
			</aside>

			<main class="min-w-0 flex-1 space-y-8 lg:min-h-0 lg:overflow-y-auto lg:pb-8">
				<p class="text-sm text-fg-subtle">{activePage.description}</p>

				{#if activePage.id === 'integrations'}
					<section class="rounded-card border border-border bg-surface-raised p-4 shadow-card">
						<h2 class="mb-3 text-lg font-semibold text-fg">Connected sources</h2>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{#each connectedSources as source (source.id)}
								{@const Icon = source.icon}
								<button
									type="button"
									class="flex items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 text-left hover:bg-surface-hover"
									onclick={() => selectPage(source.page, source.anchor)}
								>
									<Icon class="h-5 w-5 shrink-0 text-fg-muted" />
									<span class="flex-1 text-sm text-fg">{source.label}</span>
									<span
										class="h-2 w-2 rounded-full {source.connected === true
											? 'bg-success'
											: source.connected === false
												? 'bg-fg-subtle/40'
												: 'bg-fg-subtle/20'}"
									>
										<span class="sr-only">
											{source.connected === true
												? 'Connected'
												: source.connected === false
													? 'Not connected'
													: 'Status unknown'}
										</span>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				{#each activePage.sections as section (section.id)}
					<section id={`section-${section.id}`}>
						<h2 class="mb-3 text-lg font-semibold text-fg">{section.label}</h2>
						<SettingsTabContent tab={section.id} isAdmin={authStore.isAdmin} />
					</section>
				{/each}
			</main>
		</div>
	</div>
</div>
