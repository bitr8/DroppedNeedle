<script lang="ts">
	import { Check, Info, TriangleAlert, X } from 'lucide-svelte';
	import { toastStore, type Toast } from '$lib/stores/toast';

	let { raised = false }: { raised?: boolean } = $props();

	const ICON = { success: Check, error: X, warning: TriangleAlert, info: Info, neutral: Info };
	const TONE: Record<Toast['type'], string> = {
		success: 'text-success',
		error: 'text-danger',
		warning: 'text-warning',
		info: 'text-info',
		neutral: 'text-fg-muted'
	};
	const focusRing =
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

{#if $toastStore}
	{@const t = $toastStore}
	{@const Icon = ICON[t.type]}
	<div
		class="fixed inset-x-4 z-50 transition-[bottom,opacity,translate] duration-200 ease-standard starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none md:inset-x-auto md:right-6 md:w-[26rem] {raised
			? 'bottom-24 md:bottom-28'
			: 'bottom-4 md:bottom-6'}"
		data-testid="toast"
		data-type={t.type}
	>
		<div
			class="flex items-center gap-3 rounded-overlay border border-hairline bg-surface-overlay py-2.5 pr-2 pl-3 text-fg shadow-overlay"
			role={t.type === 'error' ? 'alert' : 'status'}
			aria-live={t.type === 'error' ? 'assertive' : 'polite'}
		>
			<span
				class="grid size-8 shrink-0 place-items-center rounded-full bg-current/12 {TONE[t.type]}"
			>
				<Icon class="size-4" aria-hidden="true" />
			</span>
			<span class="min-w-0 flex-1 text-sm leading-snug text-fg">{t.message}</span>
			{#if t.action}
				<button
					type="button"
					class="shrink-0 rounded-control px-2.5 py-1.5 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent-soft {focusRing}"
					onclick={t.action.onClick}
				>
					{t.action.label}
				</button>
			{/if}
			<button
				type="button"
				class="grid size-8 shrink-0 place-items-center rounded-control text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg {focusRing}"
				onclick={() => toastStore.hide()}
				aria-label="Dismiss"
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}
