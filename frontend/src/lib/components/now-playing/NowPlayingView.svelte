<script lang="ts">
	import { playerStore } from '$lib/stores/player.svelte';
	import { getCoverUrl } from '$lib/utils/errorHandling';
	import { albumHrefOrNull, artistHrefOrNull } from '$lib/utils/entityRoutes';
	import { formatDurationSec } from '$lib/utils/formatting';
	import EmptyState from '$lib/components/kit/EmptyState.svelte';
	import EqPanel from '$lib/components/EqPanel.svelte';
	import UpNextList from './UpNextList.svelte';
	import {
		Disc3,
		Pause,
		Play,
		SkipBack,
		SkipForward,
		SlidersHorizontal,
		Volume2
	} from 'lucide-svelte';

	let washColor = $state('');
	let lastCoverKey = '';
	let eqOpen = $state(false);

	const nowPlaying = $derived(playerStore.nowPlaying);
	const coverUrl = $derived(
		nowPlaying ? getCoverUrl(nowPlaying.coverUrl, nowPlaying.albumId) : null
	);
	const albumLink = $derived(nowPlaying ? albumHrefOrNull(nowPlaying.albumId) : null);
	const artistLink = $derived(nowPlaying ? artistHrefOrNull(nowPlaying.artistId) : null);

	$effect(() => {
		const key = coverUrl ?? '';
		if (key !== lastCoverKey) {
			lastCoverKey = key;
			washColor = '';
		}
	});

	function handleArtLoad(e: Event): void {
		const img = e.target as HTMLImageElement;
		if (!img.complete || img.naturalWidth === 0) return;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) return;
			ctx.drawImage(img, 0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			washColor = `${r}, ${g}, ${b}`;
		} catch {
			washColor = '';
		}
	}

	function handleSeek(e: Event): void {
		playerStore.seekTo(Number((e.target as HTMLInputElement).value));
	}

	function handleVolume(e: Event): void {
		playerStore.setVolume(Number((e.target as HTMLInputElement).value));
	}
</script>

{#if !nowPlaying}
	<EmptyState
		icon={Disc3}
		title="Nothing playing"
		description="Pick something from your library to get started."
		ctaLabel="Browse library"
		ctaHref="/library"
	/>
{:else}
	<div class="relative min-h-full">
		<div
			class="pointer-events-none fixed inset-0 -z-10 bg-surface"
			style:background-image={washColor
				? `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${washColor}, 0.32), transparent 65%)`
				: ''}
		></div>

		<div class="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-8 sm:py-12">
			<div class="w-full max-w-sm overflow-hidden rounded-card shadow-overlay">
				{#if coverUrl}
					<img
						src={coverUrl}
						alt={nowPlaying.albumName}
						crossorigin="anonymous"
						class="aspect-square w-full object-cover"
						onload={handleArtLoad}
					/>
				{:else}
					<div
						class="grid aspect-square w-full place-items-center bg-surface-raised text-fg-subtle"
					>
						<Disc3 class="size-16" strokeWidth={1.5} />
					</div>
				{/if}
			</div>

			<div class="w-full text-center">
				<h1 class="hero-title truncate text-2xl font-bold text-fg">
					{nowPlaying.trackName || nowPlaying.albumName}
				</h1>
				<p class="mt-1 truncate text-base text-fg-muted">
					{#if albumLink}
						<a href={albumLink} class="hover:text-fg hover:underline">{nowPlaying.albumName}</a>
					{:else}
						{nowPlaying.albumName}
					{/if}
					·
					{#if artistLink}
						<a href={artistLink} class="hover:text-fg hover:underline">{nowPlaying.artistName}</a>
					{:else}
						{nowPlaying.artistName}
					{/if}
				</p>
				{#if playerStore.playbackState === 'error'}
					<p class="mt-2 text-sm text-danger">This track isn't available right now.</p>
				{/if}
			</div>

			<div class="w-full">
				<input
					type="range"
					class="w-full accent-accent disabled:opacity-50"
					min="0"
					max={playerStore.duration || 1}
					value={playerStore.progress}
					disabled={!playerStore.isSeekable}
					oninput={handleSeek}
					aria-label="Seek"
				/>
				<div class="mt-1 flex justify-between font-mono text-xs text-fg-subtle">
					<span>{formatDurationSec(playerStore.progress)}</span>
					<span>{formatDurationSec(playerStore.duration)}</span>
				</div>
				{#if !playerStore.isSeekable}
					<p class="mt-1 text-center text-xs text-fg-subtle">
						This stream doesn't support seeking.
					</p>
				{/if}
			</div>

			<div class="flex items-center gap-6">
				<button
					type="button"
					class="grid size-11 place-items-center rounded-full text-fg disabled:opacity-30"
					disabled={!playerStore.hasPrevious}
					onclick={() => playerStore.previousTrack()}
					aria-label="Previous"
				>
					<SkipBack class="size-6 fill-current" />
				</button>
				<button
					type="button"
					class="grid size-16 place-items-center rounded-full bg-accent text-accent-fg shadow-overlay"
					onclick={() => playerStore.togglePlay()}
					aria-label={playerStore.isPlaying ? 'Pause' : 'Play'}
				>
					{#if playerStore.isPlaying}
						<Pause class="size-7 fill-current" />
					{:else}
						<Play class="ml-0.5 size-7 fill-current" />
					{/if}
				</button>
				<button
					type="button"
					class="grid size-11 place-items-center rounded-full text-fg disabled:opacity-30"
					disabled={!playerStore.hasNext}
					onclick={() => playerStore.nextTrack()}
					aria-label="Next"
				>
					<SkipForward class="size-6 fill-current" />
				</button>
			</div>

			<div class="flex w-full max-w-xs items-center gap-2">
				<Volume2 class="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
				<input
					type="range"
					class="w-full accent-accent"
					min="0"
					max="100"
					value={playerStore.volume}
					oninput={handleVolume}
					aria-label="Volume"
				/>
			</div>

			<button
				type="button"
				class="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-hover hover:text-fg"
				onclick={() => (eqOpen = !eqOpen)}
				aria-expanded={eqOpen}
			>
				<SlidersHorizontal class="size-3.5" aria-hidden="true" />
				Equalizer
			</button>

			<UpNextList />
		</div>
	</div>

	<EqPanel bind:open={eqOpen} onclose={() => (eqOpen = false)} />
{/if}
