import test from 'ava';
import {waitFor} from './_utils';
import {h, render, Fragment} from 'preact';
import * as assert from 'assert/strict';
import {Router, Route, useHistory, useLocation, useParams, createMemoryHistory} from '../src/index';

test(`useHistory() returns history`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	function Check() {
		const hookHistory = useHistory();
		t.is(history, hookHistory);
		return <Fragment>{hookHistory?.location.href}</Fragment>;
	}

	t.plan(1);

	render(
		<Router history={history}>
			<Check />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, '/foo'));
});

test(`useLocation() returns [location, setLocation, history]`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	function Check() {
		const [location, setLocation, hookHistory] = useLocation();
		t.is(location.href, '/foo');
		t.is(typeof setLocation, 'function');
		t.is(history, hookHistory);
		return <Fragment>{location.href}</Fragment>;
	}

	t.plan(3);

	render(
		<Router history={history}>
			<Check />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, '/foo'));
});

test(`useLocation() re-renders on location change`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	function Check() {
		const [location] = useLocation();
		return <Fragment>{location.href}</Fragment>;
	}

	render(
		<Router history={history}>
			<Check />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, '/foo'));
	history.push('/bar');
	await waitFor(() => assert.equal(container.innerHTML, '/bar'));
	t.pass();
});

test(`useLocation().setLocation() navigates to new page`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});
	let setLocation: any;

	function Check() {
		const [location, set] = useLocation();
		setLocation = set;
		return <Fragment>{location.href}</Fragment>;
	}

	render(
		<Router history={history}>
			<Check />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, '/foo'));
	setLocation('/bar');
	await waitFor(() => assert.equal(container.innerHTML, '/bar'));
	t.is(history.length, 2);
});

test(`useParams() provides params matched by parent <Route>`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	interface CheckParams {
		id: string;
	}

	function Check() {
		const {id} = useParams<CheckParams>();
		return <Fragment>{id}</Fragment>;
	}

	render(
		<Router history={history}>
			<Route path={/^\/(?<id>.*)$/} component={Check} />
			<Route path={/^\/(?<id>.*)$/}>
				<Check />
			</Route>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'foofoo'));
	history.push('/bar');
	await waitFor(() => assert.equal(container.innerHTML, 'barbar'));
	t.pass();
});
