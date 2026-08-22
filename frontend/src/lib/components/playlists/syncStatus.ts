import type { SyncStatus } from '$lib/components/kit/SyncPill.svelte';

const SPOTIFY_PREFIX = 'spotify:';

export function isSpotifyLinked(sourceRef: string | null | undefined): boolean {
	return !!sourceRef?.startsWith(SPOTIFY_PREFIX);
}

export function spotifySourceId(sourceRef: string | null | undefined): string | null {
	return sourceRef?.startsWith(SPOTIFY_PREFIX) ? sourceRef.slice(SPOTIFY_PREFIX.length) : null;
}

const KNOWN_STATUSES: SyncStatus[] = ['syncing', 'paused', 'error', 'conflict', 'detached'];

export function toSyncPillProps(playlist: {
	spotify_sync_status?: string | null;
	spotify_synced_at?: string | null;
	spotify_missing_count?: number;
}): { status: SyncStatus; syncedAt: string | null; missingCount: number } {
	const missingCount = playlist.spotify_missing_count ?? 0;
	const raw = playlist.spotify_sync_status ?? '';
	const status = (KNOWN_STATUSES as string[]).includes(raw)
		? (raw as SyncStatus)
		: missingCount > 0
			? 'stale'
			: 'synced';
	return { status, syncedAt: playlist.spotify_synced_at ?? null, missingCount };
}
