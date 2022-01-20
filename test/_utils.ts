import {JSDOM} from 'jsdom';

// @ts-ignore
global.window = createWindow();
global.document = global.window.document;

export interface WindowSubset {
	location: {href: string; pathname: string; hash: string};
	addEventListener(name: string, callback: () => void): void;
	removeEventListener(name: string, callback: () => void): void;
	history: {
		length: number;
		state: any;
		pushState(state: any, title: string, location?: string): void;
		replaceState(state: any, title: string, location?: string): void;
		go(delta?: number): void;
		back(): void;
		forward(): void;
	};
}

export function createWindow() {
	return new JSDOM('', {url: 'https://example.com'}).window;
}

// Can't use JSDOM for navigation tests because: https://github.com/jsdom/jsdom/issues/1565
export function createWindowSubset(initial: string = '/'): WindowSubset {
	let index = 0;
	const history: [URL, any?][] = [[new URL(initial, 'https://example.com')]]; // array of [location, state?] tuples
	const listeners = new Set<() => void>();

	const that = {
		get location() {
			return {
				get href() {
					return history[index]![0].href;
				},
				get pathname() {
					return history[index]![0].pathname;
				},
				get hash() {
					return history[index]![0].hash;
				},
			};
		},
		addEventListener: (name: string, callback: () => void) => name === 'popstate' && listeners.add(callback),
		removeEventListener: (name: string, callback: () => void) => name === 'popstate' && listeners.delete(callback),
		history: {
			get length() {
				return history.length;
			},
			get state() {
				return history[index]?.[1];
			},
			pushState(state: any, title: string, location?: string) {
				const [prevLocation] = history[history.length - 1]!;
				history.splice(++index, Infinity, [
					location ? new URL(location, prevLocation.href) : prevLocation,
					state,
				]);
			},
			replaceState(state: any, title: string, location?: string) {
				const [prevLocation] = history[history.length - 1]!;
				history[index] = [location ? new URL(location, prevLocation.href) : prevLocation, state];
			},
			go(delta?: number) {
				if (delta == null) return;
				const currentIndex = index;
				index = Math.max(0, Math.min(history.length - 1, index + delta));
				if (index != currentIndex) listeners.forEach((listener) => listener());
			},
			back() {
				that.history.go(-1);
			},
			forward() {
				that.history.go(1);
			},
		},
	};

	return that;
}

/**
 * Checks if fn will eventually succeed when called multiple times within a set
 * time frame.
 */
export async function waitFor<T extends () => any>(
	fn: T,
	{timeout = 500, interval = 30}: {timeout?: number; interval?: number} = {}
): Promise<ReturnType<T>> {
	const timeoutTime = Date.now() + timeout;
	let lastError: any;

	while (Date.now() < timeoutTime) {
		await new Promise((resolve) => setTimeout(resolve, interval));
		try {
			return fn();
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError;
}
