import {h, RenderableProps, createContext, isValidElement, cloneElement, FunctionComponent} from 'preact';
import {useState, useMemo, useLayoutEffect, useContext} from 'preact/hooks';
import {Location, History} from './history';

export * from './history';

export type RouteProps<P = {}> = P & {
	match: RegExpExecArray;
	location: Location;
	history: History;
};

export const HistoryContext = createContext<History | null>(null);
export const ParamsContext = createContext<{[key: string]: string} | null>(null);

/**
 * Returns current history interface.
 */
export function useHistory() {
	const history = useContext(HistoryContext);
	if (history) return history;
	throw new Error('No router provider found.');
}

/**
 * Returns `RegExpExecArray.groups` map of the matched expression on the parent
 * `<Route/>` component.
 *
 * ```
 * // Route definition somewhere in the app's root component
 * <Route path={/^\/users\/(?<id>\w+)$/} component={UserRoute} />
 *
 * // UserRoute component implementation
 * interface UserRouteParams {
 *   id: string;
 * }
 *
 * function UserRoute() {
 *   const {id} = useParams<UserRouteParams>();
 *   const data = getUserDataSomehow(id);
 *   return <User data={data} />;
 * }
 * ```
 */
export function useParams<T extends {} = {}>(): T {
	const params = useContext(ParamsContext);
	if (params) return params as T;
	throw new Error('No params provider found.');
}

/**
 * Facilitates reading/writing location, and reloading on change.
 *
 * Also returns `history` as 3rd item for convenience.
 * Difference from `useHistory()` is that `useHistory()` doesn't re-render the
 * current component when location changes.
 *
 * ```
 * const [location, navigate, history] = useLocation();
 * const {url, path, search, searchParams, hash} = location;
 * navigate('/foo/bar');
 * ```
 */
export function useLocation(): [Location, (location: string) => void, History] {
	const history = useHistory();
	const [, setNaNToUpdate] = useState(NaN); // `NaN === NaN` is always false
	const unsubscribe = useMemo(() => history.subscribe(() => setNaNToUpdate(NaN)), [history]);
	useLayoutEffect(() => unsubscribe, [history]);
	return [history.location, history.push, history];
}

/**
 * History context provider.
 *
 * ```
 * <Router history={createBrowserHistory()}>
 *   <App/>
 * </Router>
 * ```
 */
export function Router({history, children}: RenderableProps<{history: History}>) {
	return <HistoryContext.Provider value={history}>{children}</HistoryContext.Provider>;
}

/**
 * Renders element if its path expression matches current location.
 *
 * ```
 * <Route path={/regexp/} component={Foo} /> // Foo receives `{match, location, history}` as props here
 * <Route path={/regexp/}><Foo/></Route>
 * <Route path={/regexp/}>{(match: RegExpMatchArray, location: Location, history: History) => <Foo/>}</Route>
 * ```
 */
export function Route({
	path,
	component: Component,
	children,
	_match,
}: RenderableProps<{
	path: RegExp;
	component?: FunctionComponent<RouteProps>;
	_match?: RegExpExecArray;
}>) {
	const [location, , history] = useLocation();
	const match = _match || path.exec(location.path);
	return match ? (
		<ParamsContext.Provider value={match?.groups || {}}>
			{Component ? (
				<Component match={match} location={location} history={history} />
			) : typeof children === 'function' ? (
				children({match, location, history})
			) : (
				children
			)}
		</ParamsContext.Provider>
	) : null;
}

/**
 * Renders first matching route element.
 *
 * ```
 * <Switch>
 *   <Route path={/^\/foo\/bar$/} component={FooBar} />
 *   <Route path={/^\/foo$/}><Foo /></Route>
 *   <Route path={/^\/foo/alt$/}>{({match, location, history}: RouteProps) => <Foo />}</Route>
 *   <Route path={/^\/.*$/} component={Default} />
 * </Switch>
 *
 * function Foo() {}
 * function FooBar({match, location, history}: RouteProps) {}
 * function Default() {}
 * ```
 */
export function Switch({children}: RenderableProps<{}>) {
	const [{path: currentPath}] = useLocation();

	for (const element of Array.isArray(children) ? children : [children]) {
		if (!isValidElement(element)) continue;

		const path = (element?.props as any)?.path as RegExp | undefined;
		if (path && typeof path === 'object' && typeof path.exec === 'function') {
			const match = path.exec(currentPath);
			if (match) return cloneElement(element, {_match: match});
		} else {
			throw new Error(`"path" not a RegExp.`);
		}
	}

	return null;
}

/**
 * Redirect component.
 *
 * Can also be used as a <Switch> child.
 *
 * ```
 * <Redirect path={/\/something/} to={'/route'} />
 * ```
 */
export function Redirect({to, state}: {to: string; state?: any; path?: RegExp}) {
	const history = useHistory();
	useLayoutEffect(() => history.replace(to, state), []);
	return null;
}

/**
 * Basic anchor with no styling or active path class support.
 *
 * ```
 * <Link to={'/users'}>Users</Link> // <a href="/users">Users</a>
 * ```
 */
export function Link({
	to,
	state,
	children,
	...rest
}: RenderableProps<{to: string; state?: any; [key: string]: unknown}>) {
	const history = useHistory();
	const handleClick = (event: Event) => {
		event.preventDefault();
		history.push(to, state);
	};

	return (
		<a {...rest} href={to} onClick={handleClick}>
			{children}
		</a>
	);
}
