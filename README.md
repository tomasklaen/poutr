# poutr

Simple and tiny routing library for preact.

Features:

-   Tiny, ~2KB min, ~1KB gz. ([bundlephobia](https://bundlephobia.com/package/poutr) sizes include all 3 history drivers, 2 of them will be shaken away)
-   Regular expressions with named capture groups as path identifiers.
-   History drivers for browser history, browser hash, and memory.
-   Memory driver can seamlessly integrate with all native navigation methods like mouse back/forward buttons. Useful in environments like Electron apps.
-   Fully typed.

Requirements:

-   RegExp named capture groups: 92.14% browser support as of January 2022 (Edge 78+)
    -   Not strictly a requirement since `@babel/plugin-transform-named-capturing-groups-regex` exists.
    -   _Router works without this, but you can't conveniently name and consume the groups captured by path expressions._
-   Function components only. It _should_ work for classes as well, but these are not tested or supported.

## Install

```
npm install poutr
```

## Usage

As you would any other router, with a notable difference of using regular expressions with named capture groups instead of path strings. This not only means we don't need to bloat the router with path string to regexp compilers, but also gives you WAY more power in what your expressions can and cannot match.

```tsx
import {h, render} from 'preact';
import {Router, Switch, Route, RouteProps, Redirect, useParams, createBrowserHistory} from 'poutr';

// Main App component
function App() {
	// Switch renders first component whose path expression matches current path.
	// Following are all supported Route, Redirect, or direct component children.
	return (
		<Switch>
			<Route path={/^\/$/} component={Homepage} />
			<Route path={/^\//}>
				<Homepage />
			</Route>
			<Route path={/^\/(?<category>player|coach)\/(?<id>\w+)$/} component={User} />
			<Redirect path={/^\/(some|aliases|of|homepage)(\/.*)?$/} to="/" />
			<NotFound path={/.*/} />
		</Switch>
	);
}

// Basic homepage component
function Homepage() {
	return <h1>Homepage</h1>;
}

// User component accepts params
interface UserParams {
	category: string;
	id: string;
}

function User() {
	const {category, id} = useParams<UserParams>();
	const data = getUserDataSomehow(id);
	return category === 'player' ? <Player data={data} /> : <Coach data={data} />;
}

// Component can also be a Route if it accepts RouteProps.
// Note that this component can't use `useParams()` hook, as it doesn't have a
// `<Route/>` parent, which is the provider of that data.
function NotFound({location}: RouteProps) {
	return (
		<div class="NotFound">
			<h1>404 not found</h1>
			<code>{location.path}</code>
		</div>
	);
}

// Render our app
const history = createBrowserHistory();
render(
	<Router history={history}>
		<App />
	</Router>,
	document.querySelector('#app')
);
```

## Examples

TodoMVC using preact, [statin](https://github.com/tomasklaen/statin), and poutr: https://codesandbox.io/s/todomvc-preact-statin-poutr-b1s45

## API

### Location

```ts
interface Location {
	readonly href: string; // path + search + hash
	readonly path: string;
	readonly search: string;
	readonly searchParams: URLSearchParams;
	readonly hash: string;
	readonly state: any;
}
```

`Location` interface available around the API. `searchParams` is the browser's [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) object.

**NOTE**: the `href` property contains only `path` + `search` + `hash` parts. It does NOT contain domain, protocol or anything else. These are the only parts router is concerned about. It also provides consistency between different history providers (hash and memory don't have domains).

---

### History

```ts
interface History {
	location: Location;
	from?: Location;
	state: any;
	go: (delta: number) => void;
	back: () => void;
	forward: () => void;
	push: (location: string, state?: any) => void;
	replace: (location: string, state?: any) => void;
	subscribe: (listener: Listener) => () => void;
	unsubscribe: (listener: Listener) => void;
	destroy: () => void;
}

type Action = 'POP' | 'PUSH' | 'REPLACE';
type Listener = (change: {action: Action; location: Location; from?: Location}) => void;
type Disposer = () => void;
```

History interface returned by all `create{Type}History()` functions. Props:

-   **location**: Object with current location data.
-   **from**: Object with last location data. `undefined` on init.
-   **state**: State attached to current route by `push()` or `replace()`.
-   **go**: Navigate history by arbitrary number of steps. For example `history.go(-2)` would go 2 steps back.
-   **back/forward**: Go back/forward in history.
-   **push/replace**: Push new, or replace current route. When navigating back and then pushing new route, all forward routes will be removed.
-   **subscribe**: Subscribes listener to history changes, and returns a disposer for current listener. Example:
    ```ts
    // Subscribe listener
    const dispose = history.subscribe((action, location, from) => {});
    dispose(); // Unsubscribe listener
    ```
-   **unsubscribe**: Alternative to using a disposer.
-   **destroy**: Destroy current browser history instance. Unsubscribes all listeners, stops listening to window history events, etc.

---

### createBrowserHistory

```ts
function createBrowserHistory(options?: {window?: Window} = {}): History;
```

Creates a history interface that attaches itself to current (or provided) `window.history`.

---

### createHashHistory

```ts
function createHashHistory(options?: {hashSubstitute?: string; window?: Window} = {}): History;
```

Creates a history interface that attaches itself to current (or provided) `window.location.hash`.

Even though these routes are store in a hash, they can have their own hash as well. This is accomplished by delimiting path+search and hash parts of the url with `hashSubstitute` character, which is by default `\uFF03` (a full width number sign: `＃`, similar to hash but not hash).

---

### createMemoryHistory

```ts
function createMemoryHistory(options?: {initial?: string; window?: Window} = {}): History;
```

Creates a history that lives in a `state` property of a tiny internally mocked `window.history` interface. This allows not only easier testing, but in environments such as Electron apps, you can pass a current `window` object, and memory history will tap into its `history.state` and its events, which provides seamless integration with native navigation methods such as mouse forward/backward buttons with no extra effort.

This works because in Electron apps, we can't change current location, or even it's hash without weird side effects (hence why we need to use memory history), but we can still trigger navigation events and set new history states by setting new `state` data for current path.

---

### `<Router>`

History context provider for components and hooks below.

Props:

```ts
interface RouterProps {
	history: History;
	children: VNode[];
}
```

Example:

```tsx
<Router history={createBrowserHistory()}>
	<App />
</Router>
```

---

### `<Route>`

A component that renders a component passed to it only when its `path` expression matches current path.

Capture groups matched by `path` regexp are made available to all child components via the `useParams()` hook.

Props:

```ts
interface RouteProps {
	path: RegExp;
	component?: FunctionComponent<RouteProps>;
	children?: VNode[];
}
```

Examples:

```tsx
// Component passed in as a prop
<Route path={/^\/foo/} component={Foo} />

// As a child element
<Route path={/^\/foo/}/><Foo /></Route>
```

Every component passed via the `component` prop, or if it's the only child of the `<Route>` receives `location`, `match`, and `history` as props. You can type it with `RouteProps` utility type, which is just:

```ts
type RouteProps<P = {}> = P & {
	match: RegExpExecArray;
	location: Location;
	history: History;
};
```

Example:

```tsx
<Route path={/\/^foo\/(?<category>\w+)/} component={Foo} />

function Foo({match}: RouteProps) {
	return <h1>Category is: {match.props.category}<h1>;
}
```

---

### `<Switch>`

A component that renders only the first child component whose `path` expression matches the current path. All child components have to have a `path` property that has to be a RegExp.

```tsx
<Switch>
	<Route path={/\//} component={Homepage} />
	<Route path={/\/foo/} component={Foo} />
	<Route path={/\/bar/} component={Bar} />
	<CustomComponent path={/\/bar/} />
	<Redirect path={/\/oldpath/} to="/" />
	<Route path={/.*/} component={NotFound} />
</Switch>
```

When using custom components, you can use `RouteProps` type helper to type their props.

```ts
function CustomComponent(props: RouteProps) {}
```

---

### `<Redirect>`

When rendered, redirects current path to a new path specified by `to` property, using `replaceState` method (replacing current history index with new location).

Props:

```ts
interface RedirectProps {
	to: string; // new path to redirect to
	state?: any;
	path?: RegExp;
}
```

Example:

```tsx
<Redirect to="/new/path" />
```

Accepts `path` property so that it can be used inside `<Switch>`.

Use `state` to attach data to new path's state.

---

### `<Link>`

A convenience component that renders a simple anchor link to a destination.

Props:

```ts
interface LinkProps {
	to: string;
	state?: any;
	// Other props will be assigned directly to <a>, with an
	// exception of href and onClick, which are used internally.
	[key: string]: unknown;
}
```

Example:

```tsx
<Link to="/foo">Foo</Link>
```

There is no support for active class or anything of the sorts. I find that often when writing components that need active class to be set, the try-to-do-it-all `<Link>` components of other routers are insufficient, and their API limiting. It's always better to just make a new component, and use `useLocation()` hook to determine active class and trigger navigation. Way more control over everything that way.

---

### useHistory

```ts
function useHistory(): History;
```

Returns `History` instance provided by the closest parent `<Router>` component.

Using this hook **won't** trigger re-renders of current component when history changes. You are just retrieving the history object, no subscriptions to anything are happening here.

---

### useLocation

```ts
function useLocation(): [Location, Navigate, History];
type Navigate = (newPath: string) => void;
```

Returns current `Location`, a `Navigation` setter to navigate to a new one, and for convenience a `History` object as well.

This hook subscribes to history changes, and will cause the component to re-render every time the current `Location` changes.

---

### useParams

```ts
function useParams<T extends {[key: string]: string}>(): T;
```

Returns capture groups matched by closes parent `<Route>` component. You need to type the expected params on this object manually, as the hook has no other way of knowing.

Component example:

```ts
interface FooParams {
	id: string;
}

function Foo() {
	const {id} = useParams<FooParams>();
	return <h1>ID: {id}</h1>;
}
```

Usage:

```tsx
<Route path={/^\/foo\/(?<id>\w+)/} component={Foo} />
```

---

## Notable behavior

Path stored in `Location` is always normalized like so:

-   Path always starts with a `/`.
-   All slashes are de-duplicated.
-   Trailing slashes on paths are stripped.

```
/foo//bar/ -> /foo/bar
```
