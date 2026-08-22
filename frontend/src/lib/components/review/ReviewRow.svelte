<script lang="ts">
	import AlbumImage from '$lib/components/AlbumImage.svelte';
	import ConfirmModal from '$lib/components/kit/ConfirmModal.svelte';
	import StatusPill from '$lib/components/kit/StatusPill.svelte';
	import { toastStore } from '$lib/stores/toast';
	import { formatRelativeTime } from '$lib/utils/formatting';
	import { createUuid } from '$lib/utils/uuid';
	import { getLibraryReviewQuery } from '$lib/queries/library/LibraryReviewQueries.svelte';
	import {
		acceptLibraryReviewCandidate,
		actOnLibraryReview,
		retryLibraryReview
	} from '$lib/queries/library/LibraryReviewMutations.svelte';
	import type {
		ReviewActionRequest,
		ReviewDetailResponse,
		ReviewListItem
	} from '$lib/queries/library/LibraryOperationsTypes';
	import { reasonLabel } from './reviewReason';

	type Candidate = ReviewDetailResponse['candidates'][number];

	interface Props {
		item: ReviewListItem;
		highlighted?: boolean;
	}
	let { item, highlighted = false }: Props = $props();

	// ponytail: list endpoint has no confidence score, so each row fetches its own detail.
	// N+1 (one request per visible row); move score onto the list response if this gets slow.
	const detailQuery = getLibraryReviewQuery(() => item.id);
	const accept = acceptLibraryReviewCandidate();
	const skip = actOnLibraryReview('dismiss');
	const exclude = actOnLibraryReview('exclude');
	const retry = retryLibraryReview();

	let selectedKey = $state<string | null>(null);
	let excludeOpen = $state(false);
	let overrideOpen = $state(false);
	let overrideCandidate = $state<Candidate | null>(null);

	const candidates = $derived(
		[...(detailQuery.data?.candidates ?? [])].sort((a, b) => b.evidence.score - a.evidence.score)
	);

	$effect(() => {
		if (candidates.length && !candidates.some((c) => c.candidate_key === selectedKey)) {
			selectedKey = candidates[0].candidate_key;
		}
	});

	const selected = $derived(candidates.find((c) => c.candidate_key === selectedKey) ?? null);
	const availableActions = $derived(detailQuery.data?.available_actions ?? []);

	const TONE_CLASS: Record<'success' | 'warning' | 'danger', string> = {
		success: 'bg-success/15 text-success',
		warning: 'bg-warning/15 text-warning',
		danger: 'bg-danger/15 text-danger'
	};

	function tone(score: number): 'success' | 'warning' | 'danger' {
		const pct = score * 100;
		if (pct >= 95) return 'success';
		if (pct >= 80) return 'warning';
		return 'danger';
	}

	function candidateReasonLabel(reasonCode: string): string {
		const labels: Record<string, string> = {
			CONTRADICTORY: 'The local evidence conflicts with this release',
			RELEASE_TYPE_REQUIRES_CONFIRMATION: 'Compilation or live edition needs confirmation',
			UNSAFE_RELEASE_TYPE: 'Compilation or live edition needs confirmation',
			MULTIPLE_LIKELY_RELEASES: 'More than one release is equally likely',
			UNKNOWN_EXTRAS: 'Some local tracks cannot be matched safely',
			INCOMPLETE_SUPPORT: 'The available evidence does not support the whole album'
		};
		return labels[reasonCode] ?? reasonCode.replaceAll('_', ' ').toLowerCase();
	}

	function actionBody(confirm = false): ReviewActionRequest | null {
		const detail = detailQuery.data;
		if (!detail) return null;
		return {
			expected_review_revision: detail.review.row_revision,
			expected_catalog_revision: detail.catalog_revision,
			expected_identity_revision: detail.identity_revision,
			expected_evidence_revision: detail.evidence_revision || null,
			idempotency_key: createUuid(),
			confirmation: confirm
		};
	}

	async function doAccept(candidate: Candidate, manualOverride: boolean): Promise<void> {
		const detail = detailQuery.data;
		if (!detail) return;
		try {
			await accept.mutateAsync({
				reviewId: item.id,
				body: {
					expected_review_revision: detail.review.row_revision,
					expected_catalog_revision: detail.catalog_revision,
					expected_identity_revision: detail.identity_revision,
					expected_evidence_revision: candidate.evidence_revision,
					idempotency_key: createUuid(),
					confirmation: true,
					candidate_key: candidate.candidate_key,
					manual_override: manualOverride
				}
			});
			overrideOpen = false;
		} catch {
			toastStore.show({
				message: `Couldn't accept "${candidate.evidence.album_title}"`,
				type: 'error',
				action: { label: 'Retry', onClick: () => void doAccept(candidate, manualOverride) }
			});
		}
	}

	function onAccept(): void {
		if (!selected) return;
		if (selected.automatic_safe) {
			void doAccept(selected, false);
		} else {
			overrideCandidate = selected;
			overrideOpen = true;
		}
	}

	async function onSkip(): Promise<void> {
		const body = actionBody();
		if (!body) return;
		try {
			await skip.mutateAsync({ reviewId: item.id, body });
		} catch {
			toastStore.show({
				message: 'Could not skip this album',
				type: 'error',
				action: { label: 'Retry', onClick: () => void onSkip() }
			});
		}
	}

	async function onExclude(): Promise<void> {
		const body = actionBody(true);
		if (!body) return;
		try {
			await exclude.mutateAsync({ reviewId: item.id, body });
			excludeOpen = false;
		} catch {
			toastStore.show({
				message: 'Could not mark this album as not in library',
				type: 'error',
				action: { label: 'Retry', onClick: () => void onExclude() }
			});
		}
	}

	async function onRetry(): Promise<void> {
		const body = actionBody(true);
		if (!body) return;
		try {
			await retry.mutateAsync({ reviewId: item.id, body });
		} catch {
			toastStore.show({
				message: 'Could not retry identification',
				type: 'error',
				action: { label: 'Retry', onClick: () => void onRetry() }
			});
		}
	}
</script>

<article
	data-review-id={item.id}
	data-testid="review-row"
	class="rounded-card border p-4 {highlighted
		? 'border-accent ring-2 ring-accent'
		: 'border-border'} bg-surface-raised"
>
	<div class="flex gap-3">
		<AlbumImage
			mbid={item.local_album_id ?? item.release_group_mbid ?? item.id}
			alt=""
			size="sm"
			className="h-16 w-16 shrink-0 rounded-control"
		/>
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="truncate font-semibold text-fg">{item.album_title || 'Untitled local album'}</h3>
				<StatusPill state="attention" label={reasonLabel(item.reason_code)} />
			</div>
			<p class="truncate text-sm text-fg-muted">
				{item.album_artist_name || 'Unknown album artist'} · {item.track_count} tracks
			</p>
			<p class="mt-0.5 text-xs text-fg-subtle">
				Updated {formatRelativeTime(new Date(item.updated_at * 1000))}
			</p>
		</div>
	</div>

	{#if detailQuery.isLoading}
		<div class="mt-3 h-14 animate-pulse rounded-control bg-surface-hover"></div>
	{:else if detailQuery.isError}
		<p class="mt-3 text-sm text-danger">Couldn't load candidates for this album.</p>
	{:else if candidates.length === 0}
		<p class="mt-3 text-sm text-fg-muted">No external candidates found.</p>
	{:else}
		<ul class="mt-3 space-y-1.5">
			{#each candidates as candidate (candidate.candidate_key)}
				{@const pct = Math.round(candidate.evidence.score * 100)}
				{@const supported = candidate.evidence.track_evidence.filter(
					(track) => track.classification === 'supported'
				).length}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 rounded-control border px-3 py-2 text-left {selectedKey ===
						candidate.candidate_key
							? 'border-accent bg-accent/10'
							: 'border-border hover:bg-surface-hover'}"
						onclick={() => (selectedKey = candidate.candidate_key)}
					>
						<AlbumImage
							mbid={candidate.evidence.release_group_mbid}
							alt=""
							size="xs"
							className="h-9 w-9 shrink-0 rounded-control"
						/>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium text-fg"
								>{candidate.evidence.album_title}</span
							>
							<span class="block truncate text-xs text-fg-muted"
								>{candidate.evidence.album_artist_name} · {supported}/{candidate.evidence
									.track_evidence.length} tracks map</span
							>
						</span>
						<span
							class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {TONE_CLASS[
								tone(candidate.evidence.score)
							]}">{pct}%</span
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-3 flex flex-wrap gap-2">
		<button
			type="button"
			class="rounded-control bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
			disabled={!selected || accept.isPending}
			onclick={onAccept}
		>
			Accept
		</button>
		<button
			type="button"
			class="rounded-control border border-border px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface-hover disabled:opacity-50"
			disabled={skip.isPending ||
				(availableActions.length > 0 && !availableActions.includes('dismiss'))}
			onclick={() => void onSkip()}
		>
			Skip
		</button>
		<button
			type="button"
			class="rounded-control border border-border px-3 py-1.5 text-sm font-semibold text-danger hover:bg-danger/10"
			onclick={() => (excludeOpen = true)}
		>
			Mark as not in library…
		</button>
		{#if candidates.length === 0}
			<button
				type="button"
				class="rounded-control border border-border px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface-hover disabled:opacity-50"
				disabled={retry.isPending}
				onclick={() => void onRetry()}
			>
				Retry identification
			</button>
		{/if}
	</div>
</article>

<ConfirmModal
	bind:open={overrideOpen}
	title="Use this release despite conflicts?"
	kicker="Needs confirmation"
	danger
	confirmLabel="Use anyway"
	pending={accept.isPending}
	onconfirm={() => overrideCandidate && void doAccept(overrideCandidate, true)}
>
	{#if overrideCandidate}
		<p>
			Choosing <strong>{overrideCandidate.evidence.album_title}</strong> attaches its external identity
			as a manual override. Local files and tags stay unchanged.
		</p>
		<p class="mt-2">{candidateReasonLabel(overrideCandidate.evidence.reason_code)}.</p>
	{/if}
</ConfirmModal>

<ConfirmModal
	bind:open={excludeOpen}
	title={`Mark "${item.album_title || 'this album'}" as not in library?`}
	kicker="Not in library"
	danger
	confirmLabel="Mark as not in library"
	pending={exclude.isPending}
	onconfirm={() => void onExclude()}
>
	<p>
		Files stay on disk and this can be reversed later. The album stops appearing in the library and
		connected clients.
	</p>
</ConfirmModal>
