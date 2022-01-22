import test from 'ava';
import {createWindowSubset, WindowSubset} from './_utils';
import {History, createBrowserHistory, createHashHistory, createMemoryHistory} from '../src/index';

// prettier-ignore
[
	createBrowserHistory,
	createHashHistory,
	createMemoryHistory,
].forEach(commonHistoryTests);

function commonHistoryTests(createHistory: (o?: {window?: WindowSubset}) => History) {
	const name = createHistory.name;

	test(`${name}().subscribe() subscribes a listener`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(1);
		history.subscribe(() => t.pass());
		history.push('/foo');
	});

	test(`${name}() listener receives action, location, and from in 1st argument`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(12);

		// Check PUSH action
		let dispose = history.subscribe(({action, location, from}) => {
			t.is(action, 'PUSH');
			t.is(history.location, location);
			t.is(location.path, '/foo');
			t.is(from?.path, '/');
		});
		history.push('/foo');
		dispose();

		// Check REPLACE action
		dispose = history.subscribe(({action, location, from}) => {
			t.is(action, 'REPLACE');
			t.is(history.location, location);
			t.is(location.path, '/bar');
			t.is(from?.path, '/foo');
		});
		history.replace('/bar');
		dispose();

		// Check POP action
		dispose = history.subscribe(({action, location, from}) => {
			t.is(action, 'POP');
			t.is(history.location, location);
			t.is(location.path, '/');
			t.is(from?.path, '/bar');
		});
		history.back();
		dispose();
	});

	test(`${name}().unsubscribe() unsubscribes a listener`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		const pass = () => t.pass();
		t.plan(1);
		history.subscribe(pass);
		history.push('/foo');
		history.unsubscribe(pass);
		history.push('/bar');
	});

	test(`${name}().subscribe() returns disposer which unsubscribes a listener`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(1);
		const dispose = history.subscribe(() => t.pass());
		history.push('/foo');
		dispose();
		history.push('/bar');
	});

	test(`${name}().destroy() unsubscribes all listeners and unbinds events`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(2);
		history.subscribe(() => t.pass());
		history.subscribe(() => t.pass());
		history.push('/foo');
		history.destroy();
		history.push('/bar');
	});

	test(`${name}().push() navigates to next page`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		const state = {};
		history.push('/foo', state);
		t.is(history.location.path, '/foo');
		t.is(history.location.state, state);
		t.is(history.from?.path, '/');
	});

	test(`${name}().length contains history size`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(4);
		t.is(history.length, 1);
		history.push('/2');
		t.is(history.length, 2);
		history.push('/3');
		history.push('/4');
		history.push('/5');
		history.push('/6');
		t.is(history.length, 6);
		history.go(-5);
		history.push('/2');
		t.is(history.length, 2);
	});

	test(`${name}().state contains reference to the new state`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		const state = {};
		history.push('/foo', state);
		t.is(history.location.state, state);
		t.is(history.state, state);
	});

	test(`${name}().go(delta) navigates by delta`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		const state = {};
		t.plan(4);
		history.push('/foo', state);
		history.push('/bar');
		history.push('/baz');
		history.subscribe(({action, location, from}) => {
			t.is(action, 'POP');
			t.is(location.path, '/foo');
			t.is(location.state, state);
			t.is(from?.path, '/baz');
		});
		history.go(-2);
	});

	test(`${name}().back/forward() navigate by one`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		t.plan(6);
		history.push('/foo');
		history.push('/bar');
		history.push('/baz');
		const dispose = history.subscribe(({action, location, from}) => {
			t.is(action, 'POP');
			t.is(location.path, '/bar');
			t.is(from?.path, '/baz');
		});
		history.back();
		dispose();
		history.subscribe(({action, location, from}) => {
			t.is(action, 'POP');
			t.is(location.path, '/baz');
			t.is(from?.path, '/bar');
		});
		history.forward();
	});

	test(`${name}().replace() replaces current page`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		const fooState = {};
		const oldState = {};
		const state = {};
		t.plan(9);
		history.push('/foo', fooState);
		history.push('/bar', oldState);
		const dispose = history.subscribe(({action, location, from}) => {
			t.is(action, 'REPLACE');
			t.is(location.path, '/baz');
			t.is(location.state, state);
			t.is(from?.path, '/bar');
		});
		const historyLengthBeforeReplace = history.length;
		history.replace('/baz', state);
		t.is(history.length, historyLengthBeforeReplace);
		dispose();
		history.subscribe(({action, location, from}) => {
			t.is(action, 'POP');
			t.is(location.path, '/foo');
			t.is(location.state, fooState);
			t.is(from?.path, '/baz');
		});
		history.go(-1);
	});

	test(`${name}() can also store hash`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		history.push('/foo#bar');
		t.is(history.location.hash, '#bar');
	});

	test(`${name}() can store search and hash parts individually`, (t) => {
		const window = createWindowSubset();
		const history = createHistory({window});
		history.push('/foo');
		history.push('?bar=5');
		t.is(history.location.path, '/foo');
		t.is(history.location.search, '?bar=5');
		history.push('#baz');
		t.is(history.location.path, '/foo');
		t.is(history.location.search, '?bar=5');
		t.is(history.location.hash, '#baz');
		history.push('?bar=2');
		t.is(history.location.href, '/foo?bar=2');
	});
}

test(`createBrowserHistory() attaches itself to location path`, (t) => {
	const window = createWindowSubset();
	const history = createBrowserHistory({window});
	history.push('/foo');
	t.is(window.location.pathname, '/foo');
	window.history.back();
	t.is(history.location.path, '/');
});

test(`createHashHistory() picks up from current hash`, (t) => {
	const window = createWindowSubset();
	window.history.pushState(null, '', '#/foo');
	const history = createHashHistory({window});
	t.is(history.location.path, '/foo');
});

test(`createHashHistory() attaches itself to location hash`, (t) => {
	const window = createWindowSubset();
	const history = createHashHistory({window});
	const initialPath = window.location.pathname;
	history.push('/foo');
	t.is(window.location.hash, '#/foo');
	t.is(window.location.pathname, initialPath);
	window.history.back();
	t.is(history.location.path, '/');
});

test(`createHashHistory() respects hashSubstitute`, (t) => {
	const window = createWindowSubset();
	const hashSubstitute = 'ↈ';
	const history = createHashHistory({window, hashSubstitute});
	history.push('/foo');
	history.push('#bar');
	t.is(window.location.hash, `#/foo${encodeURIComponent(hashSubstitute)}bar`);
});

test(`createMemoryHistory() attaches itself to location history state`, (t) => {
	const window = createWindowSubset();
	const history = createMemoryHistory({window});
	const initialHref = window.location.href;
	history.push('/foo');
	t.is(window.history.state?.href, '/foo');
	t.is(window.location.href, initialHref);
	window.history.back();
	t.is(history.location.path, '/');
});

test(`createMemoryHistory({initial}) respects initial location`, (t) => {
	const window = createWindowSubset();
	const history = createMemoryHistory({window, initial: 'foo?bar'});
	t.is(history.location.href, '/foo?bar');
});

test(`createMemoryHistory({initial}) throws when navigating outside memory history ranges`, (t) => {
	const window = createWindowSubset();
	window.history.pushState(null, '', '/foo');
	const history = createMemoryHistory({window, initial: 'foo?bar'});
	t.throws(
		() => {
			history.back();
		},
		{message: 'navigation out of memory history'}
	);
});
