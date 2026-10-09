import { Route, Switch } from 'wouter';

export function App() {
  return (
    <Switch>
      <Route path="/">
        <main className="screen">
          <h1>Tysiąc</h1>
        </main>
      </Route>
      <Route>
        <main className="screen">
          <h1>Not found</h1>
        </main>
      </Route>
    </Switch>
  );
}
