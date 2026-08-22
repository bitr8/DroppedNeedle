<script lang="ts">
	import { formatRelativeTime } from '$lib/utils/formatting';

	export type SyncStatus =
		| 'synced'
		| 'syncing'
		| 'stale'
		| 'conflict'
		| 'paused'
		| 'detached'
		| 'error';

	interface Props {
		status: SyncStatus;
		syncedAt?: string | null;
		missingCount?: number;
	}

	let { status, syncedAt = null, missingCount = 0 }: Props = $props();

	const TONE: Record<SyncStatus, string> = {
		synced: 'bg-success/15 text-success',
		syncing: 'bg-info/15 text-info',
		stale: 'bg-warning/15 text-warning',
		conflict: 'bg-warning/15 text-warning',
		paused: 'bg-warning/15 text-warning',
		detached: 'bg-fg/10 text-fg-muted',
		error: 'bg-danger/15 text-danger'
	};

	let label = $derived.by(() => {
		switch (status) {
			case 'synced':
				return syncedAt ? `Synced ${formatRelativeTime(new Date(syncedAt))}` : 'Synced';
			case 'syncing':
				return 'Syncing';
			case 'stale':
				return missingCount > 0
					? `${missingCount} song${missingCount === 1 ? '' : 's'} missing`
					: 'Sync pending';
			case 'paused':
				return 'Sync paused — Spotify unreachable';
			case 'error':
				return "Couldn't sync — Retry";
			case 'conflict':
				return 'Sync issue — review';
			case 'detached':
				return 'Detached';
		}
	});
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {TONE[
		status
	]}"
	data-status={status}
>
	{#if status === 'syncing'}
		<span class="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
	{/if}
	{label}
</span>
