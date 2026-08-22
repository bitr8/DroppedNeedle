<script lang="ts">
	import { playerStore } from '$lib/stores/player.svelte';
	import { getCoverUrl } from '$lib/utils/errorHandling';
	import { formatDurationSec } from '$lib/utils/formatting';
	import { Disc3 } from 'lucide-svelte';

	const displayOrder = $derived(
		playerStore.shuffleEnabled ? playerStore.shuffleOrder : playerStore.queue.map((_, i) => i)
	);
	const currentPosition = $derived(
		playerStore.shuffleEnabled
			? Math.max(playerStore.shuffleOrder.indexOf(playerStore.currentIndex), 0)
			: playerStore.currentIndex
	);
	const upcoming = $derived(displayOrder.slice(currentPosition + 1));
</script>

{#if upcoming.length > 0}
	<div class="w-full">
		<h2 class="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Up next</h2>
		<ul class="flex flex-col gap-1">
			{#each upcoming as queueIndex (queueIndex)}
				{@const item = playerStore.queue[queueIndex]}
				{#if item}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-surface-hover"
							onclick={() => playerStore.jumpToTrack(queueIndex)}
						>
							<div class="size-10 shrink-0 overflow-hidden rounded-control bg-surface-raised">
								{#if item.albumId}
									<img
										src={getCoverUrl(item.coverUrl, item.albumId)}
										alt=""
										class="size-full object-cover"
									/>
								{:else}
									<div class="grid size-full place-items-center text-fg-subtle">
										<Disc3 class="size-4" />
									</div>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-fg">{item.trackName}</p>
								<p class="truncate text-xs text-fg-muted">{item.artistName}</p>
							</div>
							{#if item.duration}
								<span class="shrink-0 font-mono text-xs text-fg-subtle"
									>{formatDurationSec(item.duration)}</span
								>
							{/if}
						</button>
					</li>
				{/if}
			{/each}
		</ul>
	</div>
{/if}
