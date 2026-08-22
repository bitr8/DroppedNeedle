<script lang="ts">
	import '../../app.css';
	import { browser } from '$app/environment';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { migratePageSourceKeys } from '$lib/stores/musicSource';
	import { errorModal } from '$lib/stores/errorModal';
	import { libraryStore } from '$lib/stores/library';
	import { integrationStore } from '$lib/stores/integration';
	import { initCacheTTLs } from '$lib/stores/cacheTtl';
	import { playerStore } from '$lib/stores/player.svelte';
	import { launchYouTubePlayback } from '$lib/player/launchYouTubePlayback';
	import { playbackToast } from '$lib/stores/playbackToast.svelte';
	import { scrobbleManager } from '$lib/stores/scrobble.svelte';
	import { imageSettingsStore } from '$lib/stores/imageSettings';
	import { serviceStatusStore } from '$lib/stores/serviceStatus';
	import { resumeAudioEngine, setAudioElement } from '$lib/player/audioElement';
	import { eqStore } from '$lib/stores/eq.svelte';
	import Player from '$lib/components/Player.svelte';
	import PreviewWidget from '$lib/components/discover/PreviewWidget.svelte';
	import Toast from '$lib/components/kit/Toast.svelte';
	import AdminShell from '$lib/shell/AdminShell.svelte';
	import UserShell from '$lib/shell/UserShell.svelte';
	import {
		playlistModalState,
		registerPlaylistModal,
		resetPlaylistModal,
		unregisterPlaylistModal,
		type PlaylistModalHandle
	} from '$lib/stores/playlistModal.svelte';
	import { loadDiscographyModal, loadPlaylistModal } from '$lib/components/lazyComponentLoaders';
	import { discographyDownloadStore } from '$lib/stores/discographyDownload.svelte';
	import { batchDownloadStore } from '$lib/stores/batchDownloadStatus.svelte';
	import { syncStatus } from '$lib/stores/syncStatus.svelte';
	import { onMount, onDestroy, untrack } from 'svelte';
	import { cancelPendingImages } from '$lib/utils/lazyImage';
	import { abortAllPageRequests } from '$lib/utils/navigationAbort';
	import { nowPlayingStore } from '$lib/stores/nowPlayingSessions.svelte';
	import { nowPlayingReporter } from '$lib/stores/nowPlayingReporter.svelte';
	import { createNavigationProgressController } from '$lib/utils/navigationProgress';
	import { TriangleAlert, Info, X } from 'lucide-svelte';
	import type { Component, Snippet } from 'svelte';
	import { createFollowingEvents } from '$lib/queries/following/FollowingEvents';
	import { createLibraryActivityEvents } from '$lib/queries/library/LibraryActivityEvents';

	migratePageSourceKeys();

	let { children }: { children: Snippet } = $props();
	type PlaylistModalComponent = Component<Record<string, never>, PlaylistModalHandle>;

	const followingEvents = createFollowingEvents();
	const libraryActivityEvents = createLibraryActivityEvents();

	let audioElement = $state<HTMLAudioElement | undefined>(undefined);
	let PlaylistModal = $state<PlaylistModalComponent | null>(null);
	let DiscographyModal = $state<Component | null>(null);
	let playlistModalRef = $state<PlaylistModalHandle | undefined>(undefined);
	let showNavigationProgress = $state(false);

	const NAV_PROGRESS_DELAY_MS = 120;
	const NAV_PROGRESS_MIN_VISIBLE_MS = 220;
	const navigationProgress = createNavigationProgressController({
		delayMs: NAV_PROGRESS_DELAY_MS,
		minVisibleMs: NAV_PROGRESS_MIN_VISIBLE_MS,
		onVisibleChange: (visible) => {
			showNavigationProgress = visible;
		}
	});

	beforeNavigate((navigation) => {
		const fromPath = navigation.from?.url.pathname;
		const toPath = navigation.to?.url.pathname;
		if (fromPath !== toPath) {
			abortAllPageRequests();
			serviceStatusStore.clear();
		}
		navigationProgress.start();
		cancelPendingImages();
	});

	afterNavigate(() => {
		navigationProgress.finish();
	});

	let cleanupResumeListeners: (() => void) | null = null;

	function deferInit(fn: () => void): () => void {
		if ('requestIdleCallback' in window) {
			const id = window.requestIdleCallback(fn, { timeout: 2000 });
			return () => window.cancelIdleCallback(id);
		}
		const id = setTimeout(fn, 100);
		return () => clearTimeout(id);
	}

	onMount(() => {
		if (audioElement) {
			setAudioElement(audioElement);
			eqStore.replayToEngine();
		}

		const resumeAudioContext = () => {
			void resumeAudioEngine();
			cleanupResumeListeners?.();
			cleanupResumeListeners = null;
		};
		document.addEventListener('click', resumeAudioContext, { once: true });
		document.addEventListener('keydown', resumeAudioContext, { once: true });
		cleanupResumeListeners = () => {
			document.removeEventListener('click', resumeAudioContext);
			document.removeEventListener('keydown', resumeAudioContext);
		};

		document.addEventListener('keydown', handleGlobalKeydown);
	});

	$effect(() => {
		if (!playlistModalState.shouldMount || PlaylistModal) return;
		let cancelled = false;
		void loadPlaylistModal()
			.then((component) => {
				if (!cancelled) PlaylistModal = component;
			})
			.catch(() => {
				if (cancelled) return;
				resetPlaylistModal();
				playbackToast.show('Could not load the playlist dialog. Try again.', 'error');
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!discographyDownloadStore.open || DiscographyModal) return;
		let cancelled = false;
		void loadDiscographyModal()
			.then((component) => {
				if (!cancelled) DiscographyModal = component;
			})
			.catch(() => {
				if (cancelled) return;
				discographyDownloadStore.close();
				playbackToast.show('Could not load the discography dialog. Try again.', 'error');
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!playlistModalRef) return;
		const ref = playlistModalRef;
		registerPlaylistModal(ref);
		return () => unregisterPlaylistModal(ref);
	});

	// Everything auth-gated must track the session reactively, not be checked once at
	// mount: an in-app login/logout is a goto() that never remounts this layout, so a
	// mount-time check left integrations disabled (and these services stopped) until a
	// hard refresh (#155). The bodies run untracked so only the auth flag re-triggers
	// them - nowPlayingReporter.start() synchronously reads player $state, which would
	// otherwise restart every service on each play/pause.
	$effect(() => {
		const sessionUserId = authStore.user?.id ?? null;
		untrack(() => {
			resetPlaylistModal();
			discographyDownloadStore.close();
			batchDownloadStore.clear();
			PlaylistModal = null;
			playlistModalRef = undefined;
			libraryStore.setSession(sessionUserId);
		});
		if (sessionUserId) {
			const cancelDeferred = untrack(() => {
				// integration status feeds the home entry cards and the services panel
				// (only some pages call ensureLoaded themselves)
				void integrationStore.ensureLoaded();
				return deferInit(() => {
					initCacheTTLs();
					void imageSettingsStore.load();
					void restorePlayerSession();
					void scrobbleManager.init();
					syncStatus.connect();
				});
			});
			return () => {
				cancelDeferred();
				syncStatus.disconnect();
			};
		} else {
			untrack(() => {
				integrationStore.reset();
				syncStatus.disconnect();
			});
		}
	});

	$effect(() => {
		const sessionUserId = authStore.user?.id;
		if (!sessionUserId) return;
		untrack(() => {
			followingEvents.start();
			libraryActivityEvents.start(authStore.isAdmin, sessionUserId);
			// presence is server-driven now (the backend polls upstream servers itself),
			// so it no longer waits on integration status
			nowPlayingStore.start();
			nowPlayingReporter.start();
		});
		return () => {
			followingEvents.stop();
			libraryActivityEvents.stop();
			nowPlayingStore.stop();
			nowPlayingReporter.stop();
		};
	});

	onDestroy(() => {
		navigationProgress.cleanup();
		cleanupResumeListeners?.();
		cleanupResumeListeners = null;
		if (browser) {
			document.removeEventListener('keydown', handleGlobalKeydown);
		}
		syncStatus.disconnect();
		resetPlaylistModal();
		discographyDownloadStore.close();
		batchDownloadStore.clear();
	});

	function handleGlobalKeydown(e: KeyboardEvent): void {
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (!playerStore.isPlayerVisible) return;

		switch (e.key) {
			case ' ':
				e.preventDefault();
				playerStore.togglePlay();
				break;
			case 'ArrowRight':
				e.preventDefault();
				playerStore.seekTo(Math.min(playerStore.progress + 10, playerStore.duration));
				break;
			case 'ArrowLeft':
				e.preventDefault();
				playerStore.seekTo(Math.max(playerStore.progress - 10, 0));
				break;
			case 'ArrowUp':
				e.preventDefault();
				playerStore.setVolume(playerStore.volume + 5);
				break;
			case 'ArrowDown':
				e.preventDefault();
				playerStore.setVolume(playerStore.volume - 5);
				break;
		}
	}

	async function restorePlayerSession(): Promise<void> {
		const session = playerStore.restoreSession();
		if (!session) return;

		try {
			if (session.nowPlaying.sourceType === 'youtube') {
				if (!session.nowPlaying.trackSourceId) return;
				await launchYouTubePlayback({
					albumId: session.nowPlaying.albumId,
					albumName: session.nowPlaying.albumName,
					artistName: session.nowPlaying.artistName,
					coverUrl: session.nowPlaying.coverUrl,
					videoId: session.nowPlaying.trackSourceId,
					embedUrl: session.nowPlaying.embedUrl
				});
			} else {
				playerStore.resumeSession();
			}
		} catch {
			return;
		}
	}
</script>

{#if showNavigationProgress}
	<div class="fixed top-0 left-0 right-0 z-120 pointer-events-none">
		<progress class="progress progress-primary w-full h-1"></progress>
	</div>
{/if}

{#if authStore.isAdmin}
	<AdminShell {children} />
{:else}
	<UserShell {children} />
{/if}

{#if $errorModal.show}
	<dialog class="modal modal-open">
		<div class="modal-box bg-base-200 border border-base-300 shadow-xl max-w-md">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 opacity-60 hover:opacity-100"
				onclick={() => errorModal.hide()}
				aria-label="Close"
			>
				<X class="h-4 w-4" />
			</button>

			<div class="flex flex-col items-center text-center pt-2 pb-1">
				<div class="bg-error/10 rounded-full p-3 mb-4">
					<TriangleAlert class="h-8 w-8 text-error" />
				</div>

				<h3 class="text-lg font-bold text-base-content mb-2">
					{$errorModal.title}
				</h3>

				<p class="text-sm text-base-content/70 leading-relaxed">
					{$errorModal.message}
				</p>
			</div>

			{#if $errorModal.details}
				<div class="mt-4 rounded-box bg-base-300/60 border border-base-300 p-4">
					<div class="flex gap-3 items-start">
						<Info class="h-5 w-5 text-info shrink-0 mt-0.5" />
						<p class="text-sm text-base-content/80 leading-relaxed text-left">
							{$errorModal.details}
						</p>
					</div>
				</div>
			{/if}

			<div class="modal-action justify-center mt-5">
				<button class="btn btn-accent btn-sm px-6" onclick={() => errorModal.hide()}>
					Dismiss
				</button>
			</div>
		</div>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<form method="dialog" class="modal-backdrop" onclick={() => errorModal.hide()}>
			<button>close</button>
		</form>
	</dialog>
{/if}

{#if playbackToast.visible}
	<div
		class="droppedneedle-playback-toast fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-300"
		class:droppedneedle-playback-toast--player={playerStore.isPlayerVisible}
	>
		<div
			class="alert {playbackToast.type === 'error'
				? 'alert-error'
				: playbackToast.type === 'warning'
					? 'alert-warning'
					: 'alert-info'} shadow-lg px-4 py-2 min-w-64 max-w-md"
		>
			{#if playbackToast.type === 'error'}
				<X class="h-5 w-5 shrink-0" />
			{:else if playbackToast.type === 'warning'}
				<TriangleAlert class="h-5 w-5 shrink-0" />
			{:else}
				<Info class="h-5 w-5 shrink-0" />
			{/if}
			<span class="text-sm">{playbackToast.message}</span>
			<button
				class="btn btn-ghost btn-xs btn-circle"
				onclick={() => playbackToast.dismiss()}
				aria-label="Dismiss"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>
{/if}

<Toast raised={playerStore.isPlayerVisible} />

{#if browser}
	<audio bind:this={audioElement}></audio>
{/if}

<Player />
<PreviewWidget />
{#if DiscographyModal}
	<DiscographyModal />
{/if}
{#if PlaylistModal}
	<PlaylistModal bind:this={playlistModalRef} />
{/if}
