<script lang="ts">
	import type { Snippet } from 'svelte';
	import StatusPill from './StatusPill.svelte';
	import type { WorkState } from './workState';

	interface Props {
		title: string;
		state: WorkState;
		progress?: number | null;
		detail?: string | null;
		facts?: string[];
		controls?: Snippet;
	}

	let { title, state, progress, detail, facts = [], controls }: Props = $props();

	const showBar = $derived(progress !== undefined && (state === 'running' || state === 'paused'));
</script>

<div
	class="rounded-card border border-border bg-surface-raised px-4 py-3 shadow-card"
	data-testid="progress-header"
	data-state={state}
>
	<div class="flex items-center gap-3">
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h2 class="min-w-0 truncate text-lg font-bold text-fg">{title}</h2>
				<StatusPill {state} />
			</div>
			{#if detail}
				<p class="mt-0.5 truncate text-sm text-fg-muted">{detail}</p>
			{/if}
		</div>
		{#if controls}
			<div class="flex shrink-0 items-center gap-1">{@render controls()}</div>
		{/if}
	</div>
	{#if showBar}
		<div
			class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-fg/10"
			role="progressbar"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={progress ?? undefined}
			aria-label="{title} progress"
		>
			{#if progress === null}
				<div class="h-full w-2/5 animate-pulse rounded-full bg-info"></div>
			{:else}
				<div
					class="h-full rounded-full bg-info transition-[width] duration-200"
					style="width: {Math.max(0, Math.min(100, progress ?? 0))}%"
				></div>
			{/if}
		</div>
	{/if}
	{#if facts.length}
		<p class="mt-2 font-mono text-xs text-fg-subtle">{facts.join(' · ')}</p>
	{/if}
</div>
