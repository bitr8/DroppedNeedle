<script lang="ts">
	import { WORK_STATE_LABEL, type WorkState } from './workState';

	let { state, label }: { state: WorkState; label?: string } = $props();

	const TONE: Record<WorkState, string> = {
		running: 'text-info',
		queued: 'text-fg-muted',
		paused: 'text-fg-muted',
		waiting: 'text-fg-muted',
		attention: 'text-warning',
		done: 'text-success',
		failed: 'text-danger'
	};
</script>

<span
	class="inline-flex h-6 items-center gap-1.5 rounded-full bg-current/10 px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-current/20 ring-inset {TONE[
		state
	]}"
	data-state={state}
>
	{#if state === 'running'}
		<span
			class="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
			aria-hidden="true"
		></span>
	{/if}
	{label ?? WORK_STATE_LABEL[state]}
</span>
