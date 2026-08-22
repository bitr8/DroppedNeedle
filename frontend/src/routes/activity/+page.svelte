<script lang="ts">
	import { Pause, Play, RotateCcw, Square } from 'lucide-svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import WorkRow from '$lib/components/kit/WorkRow.svelte';
	import AttentionCard from '$lib/components/activity/AttentionCard.svelte';
	import { getActivityQuery } from '$lib/queries/activity/ActivityQuery.svelte';
	import {
		dismissAttentionItem,
		runActivityVerb
	} from '$lib/queries/activity/ActivityMutations.svelte';
	import type { WorkItem, WorkVerb } from '$lib/queries/activity/types';

	const query = getActivityQuery();
	const verbMutation = runActivityVerb();
	const dismissMutation = dismissAttentionItem();

	const running = $derived(query.data?.running ?? []);
	const queued = $derived(query.data?.queued ?? []);
	const attention = $derived(query.data?.attention ?? []);
	const history = $derived(query.data?.history ?? []);

	const VERB_ICON = { pause: Pause, resume: Play, stop: Square, retry: RotateCcw };
	const VERB_LABEL: Record<WorkVerb, string> = {
		pause: 'Pause',
		resume: 'Resume',
		stop: 'Stop',
		retry: 'Retry'
	};

	function runVerb(item: WorkItem, verb: WorkVerb) {
		verbMutation.mutate({ id: item.id, verb, title: item.title });
	}
</script>

<svelte:head><title>Activity · DroppedNeedle</title></svelte:head>

<div class="min-h-[calc(100vh-200px)]">
	<PageHeader subtitle="Everything the system is doing, and everything it needs from you">
		{#snippet title()}Activity{/snippet}
	</PageHeader>

	<div class="mx-auto flex max-w-[64rem] flex-col gap-6 px-4 pb-12 sm:px-6 lg:px-8">
		{#if running.length}
			<section>
				<h2 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">Running</h2>
				<div class="flex flex-col gap-2">
					{#each running as item (item.id)}
						{#snippet controls()}
							<div class="flex items-center gap-1">
								{#each item.controls as verb (verb)}
									{@const Icon = VERB_ICON[verb]}
									<button
										type="button"
										class="rounded-control p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg"
										onclick={() => runVerb(item, verb)}
										aria-label="{VERB_LABEL[verb]} {item.title}"
									>
										<Icon class="size-4" aria-hidden="true" />
									</button>
								{/each}
							</div>
						{/snippet}
						<WorkRow
							title={item.title}
							state={item.state}
							detail={item.detail}
							progress={item.progress}
							facts={item.facts}
							href={item.href ?? undefined}
							controls={item.controls.length ? controls : undefined}
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if queued.length}
			<section>
				<h2 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">Queued</h2>
				<div class="flex flex-col gap-2">
					{#each queued as item (item.id)}
						{#snippet controls()}
							<div class="flex items-center gap-1">
								{#each item.controls as verb (verb)}
									{@const Icon = VERB_ICON[verb]}
									<button
										type="button"
										class="rounded-control p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg"
										onclick={() => runVerb(item, verb)}
										aria-label="{VERB_LABEL[verb]} {item.title}"
									>
										<Icon class="size-4" aria-hidden="true" />
									</button>
								{/each}
							</div>
						{/snippet}
						<WorkRow
							title={item.title}
							state={item.state}
							detail={item.detail}
							progress={item.progress}
							facts={item.facts}
							href={item.href ?? undefined}
							controls={item.controls.length ? controls : undefined}
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if attention.length}
			<section>
				<h2 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">
					Needs attention
				</h2>
				<div class="flex flex-col gap-2">
					{#each attention as item (item.id)}
						<AttentionCard
							{item}
							ondismiss={(i) => dismissMutation.mutate({ id: i.id, what: i.what })}
						/>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h2 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">History</h2>
			{#if history.length}
				<div class="flex flex-col gap-2">
					{#each history as item (item.id)}
						<WorkRow
							title={item.title}
							state={item.state}
							detail={item.detail}
							progress={item.progress}
							facts={item.facts}
							href={item.href ?? undefined}
						/>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-fg-muted">Nothing here yet.</p>
			{/if}
		</section>
	</div>
</div>
