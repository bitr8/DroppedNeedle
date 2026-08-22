<script lang="ts">
	import { WORK_STATE_LABEL, type WorkState } from './workState';

	let { state, label }: { state: WorkState; label?: string } = $props();

	const TONE: Record<WorkState, string> = {
		running: 'bg-info/15 text-info',
		queued: 'bg-fg/10 text-fg-muted',
		paused: 'bg-fg/10 text-fg-muted',
		waiting: 'bg-fg/10 text-fg-muted',
		attention: 'bg-warning/15 text-warning',
		done: 'bg-success/15 text-success',
		failed: 'bg-danger/15 text-danger'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap {TONE[
		state
	]}"
	data-state={state}
>
	{#if state === 'running'}
		<span class="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
	{/if}
	{label ?? WORK_STATE_LABEL[state]}
</span>
