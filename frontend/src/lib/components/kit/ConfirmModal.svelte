<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		kicker?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		pending?: boolean;
		error?: string | null;
		onconfirm: () => void;
		children?: Snippet;
	}

	let {
		open = $bindable(false),
		title,
		kicker,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		danger = false,
		pending = false,
		error = null,
		onconfirm,
		children
	}: Props = $props();

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

	const focusRing =
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<!-- bottom sheet on phones, centred card from sm: up -->
<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && (open = false)}
	class="mx-auto mt-auto mb-0 w-full max-w-full rounded-t-overlay border border-hairline bg-surface-overlay p-0 text-fg shadow-overlay transition-[opacity,translate] duration-200 ease-standard backdrop:bg-surface/70 backdrop:backdrop-blur-sm starting:open:translate-y-3 starting:open:opacity-0 motion-reduce:transition-none sm:m-auto sm:w-[min(100vw-2rem,28rem)] sm:rounded-overlay"
>
	<div class="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
		{#if kicker}
			<p
				class="text-[0.6875rem] font-semibold tracking-label uppercase {danger
					? 'text-danger'
					: 'text-fg-muted'}"
			>
				{kicker}
			</p>
		{/if}
		<h2
			bind:this={heading}
			id={titleId}
			tabindex="-1"
			class="mt-1.5 font-display text-xl leading-tight font-semibold tracking-display outline-none"
		>
			{title}
		</h2>
		{#if children}
			<div class="mt-3 text-sm leading-body text-fg-muted">{@render children()}</div>
		{/if}
		{#if error}
			<p
				role="alert"
				class="mt-4 rounded-control border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger"
			>
				{error}
			</p>
		{/if}
		<div class="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
			<button
				type="button"
				class="h-10 rounded-control border border-border px-4 text-sm font-semibold text-fg transition-colors duration-150 hover:bg-surface-hover {focusRing}"
				onclick={() => (open = false)}
			>
				{cancelLabel}
			</button>
			<button
				type="button"
				class="h-10 rounded-control px-4 text-sm font-semibold text-accent-fg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 {focusRing} {danger
					? 'bg-danger hover:bg-danger/90'
					: 'bg-accent hover:bg-accent-hover'}"
				disabled={pending}
				onclick={onconfirm}
			>
				{confirmLabel}
			</button>
		</div>
	</div>
</dialog>
