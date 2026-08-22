import { writable } from 'svelte/store';

interface Toast {
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration?: number;
}

function createToastStore() {
	const { subscribe, set } = writable<Toast | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	return {
		subscribe,
		show: (toast: Toast) => {
			clearTimeout(timer);
			set(toast);
			timer = setTimeout(() => set(null), toast.duration ?? 3000);
		},
		hide: () => {
			clearTimeout(timer);
			set(null);
		}
	};
}

export const toastStore = createToastStore();
