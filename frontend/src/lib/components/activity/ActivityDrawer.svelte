<script lang="ts">
	import { Pause, Play, RotateCcw, Square, X } from 'lucide-svelte';
	import WorkRow from '$lib/components/kit/WorkRow.svelte';
	import { getActivityQuery } from '$lib/queries/activity/ActivityQuery.svelte';
	import {
		dismissAttentionItem,
		runActivityVerb
	} from '$lib/queries/activity/ActivityMutations.svelte';
	import type { WorkItem, WorkVerb } from '$lib/queries/activity/types';
	import AttentionCard from './AttentionCard.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	const titleId = $props.id();
	let dialog = $state<HTMLDialogElement>();
	let heading = $state<HTMLHeadingElement>();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			heading?.focus();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	const query = getActivityQuery();
	const verbMutation = runActivityVerb();
	const dismissMutation = dismissAttentionItem();

	const running = $derived(query.data?.running ?? []);
	const queued = $derived(query.data?.queued ?? []);
	const attention = $derived(query.data?.attention ?? []);
	const empty = $derived(running.length + queued.length + attention.length === 0);

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

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	class="fixed inset-y-0 right-0 m-0 h-dvh max-h-dvh w-[min(100vw-2rem,26rem)] max-w-none border-l border-border bg-surface-overlay p-0 text-fg shadow-overlay backdrop:bg-black/60"
>
	<div class="flex h-full flex-col">
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<h2 bind:this={heading} id={titleId} tabindex="-1" class="text-lg font-bold outline-none">
				Activity
			</h2>
			<div class="flex items-center gap-1">
				<a href="/activity" class="text-sm font-semibold text-accent hover:underline">View all</a>
				<button
					type="button"
					class="rounded-control p-1 text-fg-muted hover:bg-surface-hover hover:text-fg"
					onclick={() => (open = false)}
					aria-label="Close"
				>
					<X class="size-5" aria-hidden="true" />
				</button>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto p-4">
			{#if empty}
				<p class="text-sm text-fg-muted">Nothing going on right now.</p>
			{/if}

			{#if running.length}
				<h3 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">Running</h3>
				<div class="mb-4 flex flex-col gap-2">
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
			{/if}

			{#if queued.length}
				<h3 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">Queued</h3>
				<div class="mb-4 flex flex-col gap-2">
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
			{/if}

			{#if attention.length}
				<h3 class="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fg-subtle">
					Needs attention
				</h3>
				<div class="flex flex-col gap-2">
					{#each attention as item (item.id)}
						<AttentionCard
							{item}
							ondismiss={(i) => dismissMutation.mutate({ id: i.id, what: i.what })}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</dialog>
