<script lang="ts">
	import {
		deletePlaylist,
		detachSpotifyPlaylist,
		fetchPlaylist,
		isRedactedPlaylist,
		syncSpotifyPlaylist,
		type PlaylistSummary
	} from '$lib/api/playlists';
	import { playlistTrackToQueueItem } from '$lib/player/queueHelpers';
	import { playerStore } from '$lib/stores/player.svelte';
	import { toastStore } from '$lib/stores/toast';
	import { authStore } from '$lib/stores/authStore.svelte';
	import { formatTotalDurationSec } from '$lib/utils/formatting';
	import { Play, Shuffle, Trash2, Lock, Globe, RefreshCw, Unlink, Loader2 } from 'lucide-svelte';
	import PlaylistMosaic from '$lib/components/PlaylistMosaic.svelte';
	import SyncPill from '$lib/components/kit/SyncPill.svelte';
	import DetachConfirmModal from './DetachConfirmModal.svelte';
	import { isSpotifyLinked, spotifySourceId, toSyncPillProps } from './syncStatus';

	interface Props {
		playlist: PlaylistSummary;
		ondelete?: (playlistId: string) => void;
		onsyncchange?: () => void;
	}

	let { playlist, ondelete, onsyncchange }: Props = $props();

	let canDelete = $derived(playlist.is_owner || authStore.isAdmin);
	let linked = $derived(isSpotifyLinked(playlist.source_ref));
	let canManageSync = $derived(linked && playlist.is_owner);

	let syncing = $state(false);
	let pill = $derived(
		syncing
			? { status: 'syncing' as const, syncedAt: null, missingCount: 0 }
			: toSyncPillProps(playlist)
	);

	let playLoading = $state(false);
	let shuffleLoading = $state(false);
	let deleteConfirming = $state(false);
	let deleting = $state(false);
	let detachOpen = $state(false);
	let detaching = $state(false);
	let confirmTimer: ReturnType<typeof setTimeout> | undefined;

	let durationText = $derived(
		playlist.total_duration ? formatTotalDurationSec(playlist.total_duration) : ''
	);
	let subtitle = $derived(
		`${playlist.track_count} track${playlist.track_count === 1 ? '' : 's'}${durationText ? ` · ${durationText}` : ''}`
	);
	let hasPlayableTracks = $derived(playlist.track_count > 0);

	async function loadQueueItems() {
		const detail = await fetchPlaylist(playlist.id);
		if (isRedactedPlaylist(detail)) return [];
		return detail.tracks
			.map(playlistTrackToQueueItem)
			.filter((item): item is NonNullable<typeof item> => item !== null);
	}

	async function handlePlay(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (playLoading || shuffleLoading || !hasPlayableTracks) return;
		playLoading = true;
		try {
			const items = await loadQueueItems();
			if (items.length === 0) {
				toastStore.show({
					message: "This playlist doesn't have anything playable yet.",
					type: 'info'
				});
				return;
			}
			playerStore.playQueue(items, 0, false);
		} catch {
			toastStore.show({ message: "Couldn't load that playlist.", type: 'error' });
		} finally {
			playLoading = false;
		}
	}

	async function handleShuffle(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (shuffleLoading || playLoading || !hasPlayableTracks) return;
		shuffleLoading = true;
		try {
			const items = await loadQueueItems();
			if (items.length === 0) {
				toastStore.show({
					message: "This playlist doesn't have anything playable yet.",
					type: 'info'
				});
				return;
			}
			playerStore.playQueue(items, 0, true);
		} catch {
			toastStore.show({ message: "Couldn't load that playlist.", type: 'error' });
		} finally {
			shuffleLoading = false;
		}
	}

	function handleDeleteClick(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		if (deleting) return;
		if (!deleteConfirming) {
			deleteConfirming = true;
			confirmTimer = setTimeout(() => (deleteConfirming = false), 3000);
			return;
		}
		void confirmDelete();
	}

	async function confirmDelete() {
		clearTimeout(confirmTimer);
		deleting = true;
		try {
			await deletePlaylist(playlist.id);
			toastStore.show({ message: 'Playlist deleted.', type: 'success' });
			ondelete?.(playlist.id);
		} catch {
			toastStore.show({ message: "Couldn't delete that playlist.", type: 'error' });
		} finally {
			deleting = false;
			deleteConfirming = false;
		}
	}

	async function runSync() {
		const spotifyId = spotifySourceId(playlist.source_ref);
		if (!spotifyId || syncing) return;
		syncing = true;
		try {
			await syncSpotifyPlaylist(spotifyId);
			toastStore.show({ message: 'Sync started', type: 'success', duration: 2500 });
			onsyncchange?.();
		} catch {
			toastStore.show({
				message: `Couldn't sync "${playlist.name}"`,
				type: 'error',
				action: { label: 'Retry', onClick: () => void runSync() }
			});
		} finally {
			syncing = false;
		}
	}

	function handleSyncClick(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		void runSync();
	}

	function openDetach(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		detachOpen = true;
	}

	async function confirmDetach() {
		if (detaching) return;
		detaching = true;
		try {
			await detachSpotifyPlaylist(playlist.id);
			toastStore.show({
				message: `"${playlist.name}" is now a local playlist.`,
				type: 'success'
			});
			detachOpen = false;
			onsyncchange?.();
		} catch {
			toastStore.show({ message: "Couldn't detach that playlist.", type: 'error' });
		} finally {
			detaching = false;
		}
	}
</script>

<div
	class="group relative flex w-full shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-card"
>
	<a
		href="/playlists/{playlist.id}"
		class="relative z-0 block rounded-t-card focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
		aria-label="Open {playlist.name}"
	>
		<figure class="relative aspect-square overflow-hidden">
			<PlaylistMosaic
				coverUrls={playlist.cover_urls}
				customCoverUrl={playlist.custom_cover_url}
				size="w-full h-full"
				rounded="none"
			/>
			{#if playlist.is_owner}
				<div
					class="absolute left-2 top-2 rounded-full bg-surface-overlay/80 p-1 backdrop-blur-sm"
					title={playlist.is_public ? 'Public playlist' : 'Private playlist'}
					aria-label={playlist.is_public ? 'Public playlist' : 'Private playlist'}
				>
					{#if playlist.is_public}
						<Globe class="h-3 w-3 text-success" />
					{:else}
						<Lock class="h-3 w-3 text-fg-muted" />
					{/if}
				</div>
			{/if}
		</figure>
		<div class="px-3 pt-3 pb-1">
			<h3 class="line-clamp-1 text-sm font-semibold text-fg">{playlist.name}</h3>
			<p class="mt-0.5 text-xs text-fg-muted">{subtitle}</p>
			{#if !playlist.is_owner && playlist.is_public && playlist.owner_name}
				<p class="mt-1 text-[10px] text-fg-subtle">Shared by {playlist.owner_name}</p>
			{/if}
			{#if linked}
				<div class="mt-1.5">
					<SyncPill
						status={pill.status}
						syncedAt={pill.syncedAt}
						missingCount={pill.missingCount}
					/>
				</div>
			{/if}
		</div>
	</a>

	<div class="flex items-center gap-1 px-3 pb-2.5 pt-1.5">
		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-full bg-success text-accent-fg disabled:opacity-40"
			onclick={handlePlay}
			disabled={!hasPlayableTracks || playLoading}
			aria-label="Play {playlist.name}"
			title={hasPlayableTracks ? `Play ${playlist.name}` : 'No playable tracks'}
		>
			{#if playLoading}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
			{:else}
				<Play class="h-3.5 w-3.5 fill-current" />
			{/if}
		</button>

		<button
			type="button"
			class="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-40"
			onclick={handleShuffle}
			disabled={!hasPlayableTracks || shuffleLoading}
			aria-label="Shuffle {playlist.name}"
			title={hasPlayableTracks ? `Shuffle ${playlist.name}` : 'No playable tracks'}
		>
			{#if shuffleLoading}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
			{:else}
				<Shuffle class="h-3.5 w-3.5" />
			{/if}
		</button>

		<div class="ml-auto flex items-center gap-1">
			{#if canManageSync}
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg disabled:opacity-40"
					onclick={handleSyncClick}
					disabled={syncing}
					aria-label="Sync {playlist.name} now"
					title="Sync now"
				>
					<RefreshCw class="h-3.5 w-3.5 {syncing ? 'animate-spin' : ''}" />
				</button>
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-hover hover:text-fg"
					onclick={openDetach}
					aria-label="Detach {playlist.name} from Spotify"
					title="Detach from Spotify"
				>
					<Unlink class="h-3.5 w-3.5" />
				</button>
			{:else if canDelete}
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-full transition-colors {deleteConfirming
						? 'bg-danger text-accent-fg'
						: 'text-fg-muted hover:bg-surface-hover hover:text-danger'}"
					onclick={handleDeleteClick}
					disabled={deleting}
					aria-label={deleteConfirming
						? `Confirm delete ${playlist.name}`
						: `Delete ${playlist.name}`}
					title={deleteConfirming ? 'Click again to delete' : `Delete ${playlist.name}`}
				>
					{#if deleting}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Trash2 class="h-3.5 w-3.5" />
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>

{#if canManageSync}
	<DetachConfirmModal
		bind:open={detachOpen}
		playlistName={playlist.name}
		trackCount={playlist.track_count}
		pending={detaching}
		onconfirm={() => void confirmDetach()}
	/>
{/if}
