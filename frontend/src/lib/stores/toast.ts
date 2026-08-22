import { writable } from 'svelte/store';

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface Toast {
	message: string;
	type: 'success' | 'error' | 'info' | 'warning' | 'neutral';
	/** ms; defaults to 4000, errors stay until dismissed */
	duration?: number | null;
	action?: ToastAction;
}

const UNDO_MS = 6000;

function createToastStore() {
	const { subscribe, set } = writable<Toast | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const hide = () => {
		clearTimeout(timer);
		set(null);
	};

	const show = (toast: Toast) => {
		clearTimeout(timer);
		set(toast);
		const duration =
			toast.duration === undefined
				? toast.type === 'error' || toast.type === 'warning'
					? null
					: 4000
				: toast.duration;
		if (duration !== null) timer = setTimeout(() => set(null), duration);
	};

	return {
		subscribe,
		show,
		hide,
		undo: (message: string, onUndo: () => void) =>
			show({
				message,
				type: 'neutral',
				duration: UNDO_MS,
				action: {
					label: 'Undo',
					onClick: () => {
						hide();
						onUndo();
					}
				}
			})
	};
}

export const toastStore = createToastStore();
