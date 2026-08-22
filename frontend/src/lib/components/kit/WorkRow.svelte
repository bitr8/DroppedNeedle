<script lang="ts">
	import type { Snippet } from 'svelte';
	import StatusPill from './StatusPill.svelte';
	import type { WorkState } from './workState';

	interface Props {
		title: string;
		state: WorkState;
		stateLabel?: string;
		detail?: string | null;
		/** 0–100; null = indeterminate; omit to hide the bar */
		progress?: number | null;
		facts?: string[];
		href?: string;
		controls?: Snippet;
	}

	let { title, state, stateLabel, detail, progress, facts = [], href, controls }: Props = $props();

	const showBar = $derived(progress !== undefined && (state === 'running' || state === 'paused'));
	const barTone = $derived(state === 'paused' ? 'bg-fg-subtle' : 'bg-info');
</script>

<div
	class="flex items-center gap-3 rounded-card border border-border bg-surface-raised px-3.5 py-2.5 shadow-card data-[state=attention]:border-warning/30 data-[state=failed]:border-danger/30"
	data-testid="work-row"
	data-state={state}
>
	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			{#if href}
				<a
					{href}
					class="min-w-0 truncate rounded-sm font-semibold text-fg decoration-fg-subtle underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>{title}</a
				>
			{:else}
				<span class="min-w-0 truncate font-semibold text-fg">{title}</span>
			{/if}
			<StatusPill {state} label={stateLabel} />
		</div>
		{#if detail}
			<p class="mt-0.5 truncate text-sm text-fg-muted">{detail}</p>
		{/if}
		{#if showBar}
			<div
				class="mt-2 h-1 w-full overflow-hidden rounded-full bg-fg/10"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progress ?? undefined}
				aria-label="{title} progress"
			>
				{#if progress === null}
					<div
						class="h-full w-2/5 animate-pulse rounded-full {barTone} motion-reduce:animate-none"
					></div>
				{:else}
					<div
						class="h-full rounded-full {barTone} transition-[width] duration-200 ease-standard"
						style="width: {Math.max(0, Math.min(100, progress ?? 0))}%"
					></div>
				{/if}
			</div>
		{/if}
		{#if facts.length}
			<p class="mt-1.5 font-mono text-[0.6875rem] text-fg-subtle">{facts.join(' · ')}</p>
		{/if}
	</div>
	{#if controls}
		<div class="flex shrink-0 items-center gap-1">{@render controls()}</div>
	{/if}
</div>
