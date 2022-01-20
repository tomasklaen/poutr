const WINDOW = window;

export interface WindowSubset {
	location: {href: string; hash: string};
	addEventListener(name: string, callback: () => void): void;
	removeEventListener(name: string, callback: () => void): void;
	history: {
		length: number;
		state: any;
		pushState(state: any, title: string, location?: string): void;
		replaceState(state: any, title: string, location?: string): void;
		go(delta?: number): void;
	};
}

export interface Location {
	readonly href: string;
	readonly path: string;
	readonly search: string;
	readonly searchParams: URLSearchParams;
	readonly hash: string;
	readonly state: any;
}

// POP: Change to an arbitrary index in the history stack.
// PUSH: New entry being added to the history stack.
// REPLACE: Entry at the current index in the history stack being replaced.
export type Action = 'POP' | 'PUSH' | 'REPLACE';

export interface History {
	location: Location;
	from?: Location;
	state: any;
	length: number;
	go: (delta: number) => void;
	back: () => void;
	forward: () => void;
	push: (location: string, state?: any) => void;
	replace: (location: string, state?: any) => void;
	subscribe: (listener: Listener) => Disposer;
	unsubscribe: (listener: Listener) => void;
	destroy: () => void;
}

export type Disposer = () => void;
export type Listener = (change: {action: Action; location: Location; from?: Location}) => void;

export interface HistoryDriver {
	getLocation(window: WindowSubset): Location;
	prepareUrl(to: string, currentLocation: Location): string | undefined;
	prepareState(state: any, to: string, currentLocation: Location): any;
}

/**
 * Utils.
 */

function createLocation(href: string, state?: any): Location {
	const url = new URL(href.includes(':') ? href : `pr:${href}`);
	const {pathname, search, searchParams, hash} = url;
	const path = `/${pathname}` // ensure slash at the beginning
		.replace(/\/+/g, '/') // removes duplicate slashes
		.replace(/.\/+$/, ''); // removes trailing slash
	return {href: path + search + hash, path, search, searchParams, hash, state};
}

function createMockedWindow(initial: string = '/'): WindowSubset {
	let index = 0;
	const history: [string, any?][] = [[initial]]; // array of [location, state?] tuples
	const listeners = new Set<() => void>();

	return {
		get location() {
			return {href: history[index]![0], hash: '#'};
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
				history.splice(++index, Infinity, [location || history[history.length - 1]![0], state]);
			},
			replaceState(state: any, title: string, location?: string) {
				history[index] = [location || history[history.length - 1]![0], state];
			},
			go(delta?: number) {
				if (delta == null) return;
				const currentIndex = index;
				index = Math.max(0, Math.min(history.length - 1, index + delta));
				if (index != currentIndex) listeners.forEach((listener) => listener());
			},
		},
	};
}

/**
 * History creator.
 */
function createHistory(window: WindowSubset, {getLocation, prepareUrl, prepareState}: HistoryDriver): History {
	let location: Location = getLocation(window);
	let from: Location | undefined;
	const listeners = new Set<Listener>();

	window.addEventListener('popstate', handlePop);

	function handlePop() {
		triggerChange('POP');
	}

	function triggerChange(action: Action) {
		from = location;
		location = getLocation(window);
		listeners.forEach((listener) => {
			listener({action, location, from});
		});
	}

	return {
		get length() {
			return window.history.length;
		},
		get location() {
			return location;
		},
		get from() {
			return from;
		},
		get state() {
			return location.state;
		},
		push(to: string, state?: any) {
			window.history.pushState(prepareState(state, to, location), '', prepareUrl(to, location));
			triggerChange('PUSH');
		},
		replace(to: string, state?: any) {
			window.history.replaceState(prepareState(state, to, location), '', prepareUrl(to, location));
			triggerChange('REPLACE');
		},
		go: (delta?: number) => window.history.go(delta),
		back: () => window.history.go(-1),
		forward: () => window.history.go(1),
		subscribe(listener: Listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		unsubscribe(listener: Listener) {
			listeners.delete(listener);
		},
		destroy() {
			window.removeEventListener('popstate', handlePop);
			listeners.clear();
		},
	};
}

/**
 * Browser history.
 *
 * Uses browser's path, search, and hash for navigation.
 * Using more than one instance per `window` will break things.
 */
export function createBrowserHistory({window = WINDOW}: {window?: WindowSubset} = {}): History {
	return createHistory(window, {
		getLocation: (window) => createLocation(window.location.href, window.history.state),
		prepareUrl: (to) => to,
		prepareState: (state) => state,
	});
}

/**
 * Hash history.
 *
 * Uses browser's hash to store and retrieve path, search, and hash.
 * Uses `hashSubstitute` for separating hash withing the hash.
 * Using more than one instance per `window` will break things.
 */
export function createHashHistory({
	window = WINDOW,
	hashSubstitute = '\uFF03', // full width number sign:＃
}: {window?: WindowSubset; hashSubstitute?: string} = {}): History {
	return createHistory(window, {
		getLocation: ({history, location}) =>
			createLocation(decodeURIComponent(location.hash.slice(1)).replace(hashSubstitute, '#'), history.state),
		prepareUrl: (to, {href}) => {
			let {pathname, search, hash} = new URL(to, `http://h.com${href}`);
			hash = hash.length > 1 ? `${hashSubstitute}${hash.slice(1)}` : '';
			return `#${pathname + search + hash}`;
		},
		prepareState: (state) => state,
	});
}

/**
 * Memory history.
 *
 * Uses a mocked window to save navigation in its history state without changing
 * its location.
 * This is so you can pass your own window and let it tap to that instead, which
 * is useful in environments like electron, where we can't change path or hash,
 * but we can still tap to state. This allows having a memory history that
 * seamlessly integrates with builtin navigation methods like mouse back/forward
 * buttons.
 *
 * Note: Memory history throws when you make it tap to document's window, and
 * use the window's instead of history's `push/replace/…` methods to navigate.
 * This is because you introduce history steps that memory history doesn't
 * recognize, which leads to undefinable behavior.
 */
export function createMemoryHistory({initial = '/', window}: {initial?: string; window?: WindowSubset} = {}): History {
	const win = window || createMockedWindow();
	const prepareState = (state: any, to: string, current?: {href: string}) => {
		const {pathname, search, hash} = new URL(to, `https://m.com${current?.href || ''}`);
		return {
			IS_MEMORY_HISTORY_STATE: true, // can't use Symbol, as it gets removed in (de)serialization
			state,
			href: `${pathname}${search}${hash}`,
		};
	};

	// Apply initial location
	win.history.replaceState(prepareState(null, initial), '');

	return createHistory(win, {
		getLocation: (window) => {
			const winState = window.history.state;
			if (!winState?.IS_MEMORY_HISTORY_STATE) throw new Error('navigation out of memory history');
			return createLocation(winState.href, winState.state);
		},
		prepareState,
		prepareUrl: () => undefined,
	});
}
