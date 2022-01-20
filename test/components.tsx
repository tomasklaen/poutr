import test from 'ava';
import {waitFor} from './_utils';
import {h, render, Fragment} from 'preact';
import {useContext} from 'preact/hooks';
import * as assert from 'assert/strict';
import {Router, Route, Switch, Link, Redirect, HistoryContext, createMemoryHistory} from '../src/index';

test(`<Router> provides history to children`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	function PrintHref() {
		const history = useContext(HistoryContext);
		return <Fragment>{history?.location.href}</Fragment>;
	}

	render(
		<Router history={history}>
			<PrintHref />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, '/foo'));
	t.pass();
});

test(`<Route> only renders when its path expression matches current route`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	render(
		<Router history={history}>
			<Route path={/\/foo/}>foo</Route>
			<Route path={/\/bar/}>bar</Route>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'foo'));
	history.push('/bar');
	await waitFor(() => assert.equal(container.innerHTML, 'bar'));
	t.pass();
});

test(`<Route> renders param component with correct props`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});
	let props: any;

	function StoreProps(passedProps: any) {
		props = passedProps;
		return <Fragment>done</Fragment>;
	}

	render(
		<Router history={history}>
			<Route path={/\/(?<name>foo)/} component={StoreProps} />
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'done'));
	t.is(props.history, history);
	t.is(props.location, history.location);
	t.is(props.match.groups.name, 'foo');
});

test(`<Route> renders child function as a component with correct props`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});
	let props: any;

	function StoreProps(passedProps: any) {
		props = passedProps;
		return <Fragment>done</Fragment>;
	}

	render(
		<Router history={history}>
			<Route path={/\/(?<name>foo)/}>{StoreProps}</Route>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'done'));
	t.is(props.history, history);
	t.is(props.location, history.location);
	t.is(props.match.groups.name, 'foo');
});

test(`<Switch> renders 1st child component with matching path`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/bar'});

	render(
		<Router history={history}>
			<Switch>
				<Route path={/\/foo/}>foo</Route>
				<Route path={/\/bar/}>bar</Route>
				<Route path={/\/bar/}>bar2</Route>
				<Route path={/\/baz/}>baz</Route>
			</Switch>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'bar'));
	history.push('/baz');
	await waitFor(() => assert.equal(container.innerHTML, 'baz'));
	t.pass();
});

test(`<Link> renders an anchor that navigates to its destination`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	render(
		<Router history={history}>
			<Link to="/bar">bar</Link>
			<div id="output">
				<Switch>
					<Route path={/\/foo/}>foo</Route>
					<Route path={/\/bar/}>bar</Route>
				</Switch>
			</div>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.querySelector('#output')?.innerHTML, 'foo'));
	container.querySelector('a')?.click();
	await waitFor(() => assert.equal(container.querySelector('#output')?.innerHTML, 'bar'));
	t.is(history.length, 2);
	t.pass();
});

test(`<Link> accepts any properties and passes them to anchor`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	render(
		<Router history={history}>
			<Link to="/bar" id="link" class="foo">
				bar
			</Link>
		</Router>,
		container
	);

	let linkElement: any;
	await waitFor(() => {
		linkElement = container.querySelector('#link');
		assert.ok(linkElement);
	});
	t.is(linkElement.className, 'foo');
});

test(`<Redirect> replaces current page when rendered`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	render(
		<Router history={history}>
			<Switch>
				<Route path={/\/foo/}>foo</Route>
				<Route path={/\/bar/}>
					<Redirect to="/baz" />
				</Route>
				<Route path={/\/baz/}>baz</Route>
			</Switch>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'foo'));
	history.push('/bar');
	await waitFor(() => assert.equal(container.innerHTML, 'baz'));
	t.is(history.length, 2);
});

test(`<Redirect> should work as a switch child`, async (t) => {
	const container = document.createElement('div');
	const history = createMemoryHistory({initial: '/foo'});

	render(
		<Router history={history}>
			<Switch>
				<Route path={/\/foo/}>foo</Route>
				<Redirect path={/\/bar/} to="/baz" />
				<Route path={/\/baz/}>baz</Route>
			</Switch>
		</Router>,
		container
	);

	await waitFor(() => assert.equal(container.innerHTML, 'foo'));
	history.push('/bar');
	await waitFor(() => assert.equal(container.innerHTML, 'baz'));
	t.is(history.length, 2);
});
